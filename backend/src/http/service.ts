import { Streak, User, UserWordProgress, Word } from "../models";
import { endOfUtcDay, utcDay } from "../lib/srs";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function serializeWord(word: any) {
  return {
    id: String(word._id),
    word: word.term,
    definition: word.definition,
    level: word.level,
    ipa: word.ipa,
    partOfSpeech: word.partOfSpeech,
    examples: word.context ? [word.context] : [],
    collocations: word.collocations || [],
    senses: word.senses || [],
    source: word.source === "wiktionary" ? "Wikizionario" : word.source,
    sourceUrl:
      word.sourceUrl ||
      (word.source === "wiktionary"
        ? `https://it.wiktionary.org/wiki/${encodeURIComponent(word.term)}`
        : undefined),
    license:
      word.license ||
      (word.source === "wiktionary" ? "CC BY-SA 4.0" : undefined),
    audioUrl: word.audioUrl,
    audioSourceUrl: word.audioSourceUrl,
    audioLicense: word.audioLicense,
  };
}
export function serializeProgress(progress: any) {
  return {
    id: String(progress._id),
    word: serializeWord(progress.wordId),
    interval: progress.interval,
    easeFactor: progress.easeFactor,
    repetitions: progress.repetitions,
    nextReviewDate: progress.nextReviewDate,
    mastery: progress.mastery.toLowerCase(),
  };
}
export async function ensureStreak(userId: string) {
  try {
    return await Streak.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId } },
      { upsert: true, returnDocument: "after" },
    );
  } catch (error: any) {
    if (error.code === 11000) return Streak.findOne({ userId });
    throw error;
  }
}
export async function pendingReviews(userId: string, now = new Date()) {
  return UserWordProgress.countDocuments({
    userId,
    nextReviewDate: { $lte: endOfUtcDay(now) },
  });
}
export async function completeDay(userId: string, now = new Date()) {
  const day = utcDay(now);
  const yesterday = utcDay(new Date(now.getTime() - 86400000));
  if (await pendingReviews(userId, now)) return;
  const selection = await ensureStreak(userId);
  if (!selection || selection.acquisitionDay !== day) return;
  const acquired = await UserWordProgress.countDocuments({
    userId,
    acquiredOn: day,
  });
  if (acquired < selection.dailyWordIds.length) return;
  if (!acquired) {
    const start = new Date(day + "T00:00:00Z");
    if (
      !(await UserWordProgress.exists({
        userId,
        lastReviewedAt: { $gte: start, $lte: now },
      }))
    )
      return;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const streak = await ensureStreak(userId);
    if (!streak || streak.lastCompletedDay === day) return;
    const current =
      streak.lastCompletedDay === yesterday ? streak.currentStreak + 1 : 1;
    const updated = await Streak.updateOne(
      { _id: streak._id, __v: streak.__v },
      {
        $set: {
          currentStreak: current,
          longestStreak: Math.max(current, streak.longestStreak),
          lastCompletedDay: day,
        },
        $inc: { __v: 1 },
      },
    );
    if (updated.modifiedCount) return;
  }
  throw new HttpError(409, "I tuoi progressi sono cambiati. Riprova.");
}
export async function dailyStatus(userId: string, now = new Date()) {
  const [pending, streak, acquired, user] = await Promise.all([
    pendingReviews(userId, now),
    ensureStreak(userId),
    UserWordProgress.countDocuments({ userId, acquiredOn: utcDay(now) }),
    User.findById(userId),
  ]);
  const yesterday = utcDay(new Date(now.getTime() - 86400000));
  const current =
    streak?.lastCompletedDay === utcDay(now) ||
    streak?.lastCompletedDay === yesterday
      ? streak.currentStreak
      : 0;
  return {
    day: utcDay(now),
    pendingReviews: pending,
    streak: current,
    longestStreak: streak?.longestStreak || 0,
    completedToday: streak?.lastCompletedDay === utcDay(now),
    newWordsUnlocked: pending === 0,
    dailyLimit: user?.dailyTarget ?? 4,
    acquiredToday: acquired,
    availableToday:
      streak?.acquisitionDay === utcDay(now)
        ? streak.dailyWordIds.length
        : null,
  };
}

/** Reserve a stable daily selection. Reading it never acquires unseen words. */
export async function acquireDaily(userId: string, now = new Date()) {
  if (await pendingReviews(userId, now))
    throw new HttpError(
      423,
      "Completa i ripassi di oggi per sbloccare nuove parole.",
    );
  const day = utcDay(now);
  let streak = await ensureStreak(userId);
  if (!streak)
    throw new HttpError(
      503,
      "Il tuo account è temporaneamente non disponibile.",
    );
  if (streak.acquisitionDay !== day) {
    const user = await User.findById(userId);
    if (!user) throw new HttpError(401, "Accedi per continuare.");
    const learned = await UserWordProgress.find({ userId }).distinct("wordId");
    const selected = await Word.find({ _id: { $nin: learned } })
      .sort({ priority: 1, term: 1 })
      .limit(user.dailyTarget);
    const claimed = await Streak.findOneAndUpdate(
      { _id: streak._id, acquisitionDay: { $ne: day } },
      {
        $set: {
          acquisitionDay: day,
          dailyWordIds: selected.map((word) => word._id),
        },
        $inc: { __v: 1 },
      },
      { returnDocument: "after" },
    );
    streak = claimed || (await Streak.findById(streak._id));
  }
  const ids = streak!.dailyWordIds;
  const selected = await Word.find({ _id: { $in: ids } }).sort({
    priority: 1,
    term: 1,
  });
  const seen = await UserWordProgress.find({
    userId,
    wordId: { $in: ids },
  }).distinct("wordId");
  // An exhausted catalog still allows a day of completed reviews to count.
  if (!ids.length) await completeDay(userId, now);
  return {
    words: selected.map(serializeWord),
    seenIds: seen.map(String),
    status: await dailyStatus(userId, now),
  };
}

/** Only a word in today's reserved selection may be acquired; retries are idempotent. */
export async function seeWord(
  userId: string,
  wordId: string,
  now = new Date(),
) {
  const day = utcDay(now);
  const selection = await Streak.findOne({
    userId,
    acquisitionDay: day,
    dailyWordIds: wordId,
  });
  if (!selection)
    throw new HttpError(
      403,
      "Questa parola non fa parte delle scoperte di oggi.",
    );
  if (
    !(await UserWordProgress.exists({ userId, wordId })) &&
    (await pendingReviews(userId, now))
  ) {
    throw new HttpError(
      423,
      "Completa i ripassi di oggi per sbloccare nuove parole.",
    );
  }
  const tomorrow = new Date(day + "T00:00:00Z");
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  try {
    await UserWordProgress.updateOne(
      { userId, wordId },
      {
        $setOnInsert: {
          userId,
          wordId,
          acquiredOn: day,
          nextReviewDate: tomorrow,
          interval: 0,
          easeFactor: 2.5,
          repetitions: 0,
          totalReviews: 0,
          successfulReviews: 0,
          mastery: "Learning",
        },
      },
      { upsert: true },
    );
  } catch (error: any) {
    if (error.code !== 11000) throw error;
  }
  await completeDay(userId, now);
  return { status: await dailyStatus(userId, now) };
}
