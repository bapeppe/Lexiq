import { Streak, UserWordProgress, Word } from '../models';
import { endOfUtcDay, utcDay } from '../lib/srs';
import { Types } from 'mongoose';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function serializeWord(word: any) {
  return { id: String(word._id), word: word.term, definition: word.definition, level: word.level,
    ipa: word.ipa, partOfSpeech: word.partOfSpeech, examples: [word.context], collocations: word.collocations };
}
export function serializeProgress(progress: any) {
  return { id: String(progress._id), word: serializeWord(progress.wordId), interval: progress.interval,
    easeFactor: progress.easeFactor, repetitions: progress.repetitions, nextReviewDate: progress.nextReviewDate,
    mastery: progress.mastery.toLowerCase() };
}
export async function ensureStreak(userId: string) {
  try { return await Streak.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { upsert: true, returnDocument: 'after' }); }
  catch (error: any) { if (error.code === 11000) return Streak.findOne({ userId }); throw error; }
}
export async function pendingReviews(userId: string, now = new Date()) {
  return UserWordProgress.countDocuments({ userId, nextReviewDate: { $lte: endOfUtcDay(now) } });
}
export async function completeDay(userId: string, now = new Date()) {
  const day = utcDay(now);
  const yesterday = utcDay(new Date(now.getTime() - 86400000));
  for (let attempt = 0; attempt < 5; attempt++) {
    const streak = await ensureStreak(userId);
    if (!streak || streak.lastCompletedDay === day) return;
    const current = streak.lastCompletedDay === yesterday ? streak.currentStreak + 1 : 1;
    const updated = await Streak.updateOne({ _id: streak._id, __v: streak.__v }, {
      $set: { currentStreak: current, longestStreak: Math.max(current, streak.longestStreak), lastCompletedDay: day }, $inc: { __v: 1 },
    });
    if (updated.modifiedCount) return;
  }
  throw new HttpError(409, 'I tuoi progressi sono cambiati. Riprova.');
}
export async function dailyStatus(userId: string, now = new Date()) {
  const [pending, streak, acquired] = await Promise.all([
    pendingReviews(userId, now), ensureStreak(userId), UserWordProgress.countDocuments({ userId, acquiredOn: utcDay(now) }),
  ]);
  const yesterday = utcDay(new Date(now.getTime() - 86400000));
  const current = streak?.lastCompletedDay === utcDay(now) || streak?.lastCompletedDay === yesterday ? streak.currentStreak : 0;
  return { day: utcDay(now), pendingReviews: pending, streak: current, longestStreak: streak?.longestStreak || 0,
    completedToday: streak?.lastCompletedDay === utcDay(now), newWordsUnlocked: pending === 0, dailyLimit: 4, acquiredToday: acquired };
}
export async function acquireDaily(userId: string, now = new Date()) {
  if (await pendingReviews(userId, now)) throw new HttpError(423, 'Completa i ripassi di oggi per sbloccare nuove parole.');
  const day = utcDay(now);
  let streak = await ensureStreak(userId);
  if (!streak) throw new HttpError(503, 'Il tuo account è temporaneamente non disponibile.');
  if (streak.acquisitionDay !== day) {
    const learned = await UserWordProgress.find({ userId }).distinct('wordId');
    const words = await Word.find({ _id: { $nin: learned } }).sort({ level: 1, _id: 1 }).limit(4);
    const claimed = await Streak.findOneAndUpdate({ _id: streak._id, acquisitionDay: { $ne: day } }, {
      $set: { acquisitionDay: day, dailyWordIds: words.map(word => word._id) }, $inc: { __v: 1 },
    }, { returnDocument: 'after' });
    streak = claimed || await Streak.findById(streak._id);
  }
  const ids = streak!.dailyWordIds;
  const tomorrow = new Date(now); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1); tomorrow.setUTCHours(0, 0, 0, 0);
  if (ids.length) {
    try { await UserWordProgress.bulkWrite(ids.map(wordId => ({ updateOne: {
      filter: { userId: new Types.ObjectId(userId), wordId }, update: { $setOnInsert: { userId: new Types.ObjectId(userId), wordId, acquiredOn: day, nextReviewDate: tomorrow,
        interval: 0, easeFactor: 2.5, repetitions: 0, totalReviews: 0, successfulReviews: 0, mastery: 'Learning' } }, upsert: true,
    } })), { ordered: false }); } catch (error: any) {
      const duplicateOnly = error.writeErrors?.length && error.writeErrors.every((item: any) => item.code === 11000);
      const count = duplicateOnly ? await UserWordProgress.countDocuments({ userId, wordId: { $in: ids } }) : 0;
      if (!duplicateOnly || count !== ids.length) throw error;
    }
    await completeDay(userId, now);
  }
  const words = await Word.find({ _id: { $in: ids } }).sort({ level: 1, _id: 1 });
  return { words: words.map(serializeWord), status: await dailyStatus(userId, now) };
}
