import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { User, UserWordProgress, Streak } from './models';
import { Session, ReviewSubmission } from './http/models';
import { hashPassword, verifyPassword, tokenHash, rateLimit } from './http/security';
import { acquireDaily, completeDay, dailyStatus, HttpError, pendingReviews, serializeProgress } from './http/service';
import { scheduleReview, masteryLevel, endOfUtcDay } from './lib/srs';

const idSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid card identifier');
const reviewSchema = z.object({ progressId: idSchema, rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), submissionId: z.uuid() }).strict();
const loginSchema = z.object({ email: z.email().max(254).transform(value => value.toLowerCase().trim()), password: z.string().min(1).max(128) }).strict();
const signupSchema = loginSchema.extend({ name: z.string().trim().min(2).max(80), password: z.string().min(10).max(128) });
const sessionDays = 30;
const dummyHash = hashPassword('unavailable account dummy password');
const asyncRoute = (handler: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { void handler(req, res).catch(next); };

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  const configuredOrigins = process.env.FRONTEND_ORIGIN?.split(',').map(value => value.trim()).filter(Boolean);
  const origins = configuredOrigins || (process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173']);
  function allowedOrigin(origin: string | undefined, host: string | undefined) {
    if (!origin) return true;
    if (origins.includes(origin)) return true;
    if (configuredOrigins) return false;
    try { const parsed = new URL(origin); return ['http:', 'https:'].includes(parsed.protocol) && parsed.host === host; } catch { return false; }
  }
  const secure = process.env.COOKIE_SECURE === 'true' || (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false');
  const cookieOptions = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge: sessionDays * 86400000 };
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'no-store');
    if (!allowedOrigin(req.headers.origin, req.headers.host) || req.headers['sec-fetch-site'] === 'cross-site') {
      next(new HttpError(403, 'This request origin is not allowed.')); return;
    }
    next();
  });
  app.use((req, res, next) => cors({ origin: req.headers.origin && allowedOrigin(req.headers.origin, req.headers.host) ? req.headers.origin : false, credentials: true })(req, res, next));
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/health', (_req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ status: mongoose.connection.readyState === 1 ? 'ok' : 'unavailable' }));
  app.use('/api', rateLimit(300, 60000));
  app.use('/api/auth', rateLimit(30, 15 * 60000));

  async function startSession(userId: string, res: Response) {
    const token = randomBytes(32).toString('base64url');
    await Session.create({ userId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + sessionDays * 86400000) });
    res.cookie('vocaloop_session', token, cookieOptions);
  }
  function publicUser(user: any) { return { id: String(user._id), name: user.name, email: user.email }; }
  app.post('/api/auth/signup', asyncRoute(async (req, res) => {
    const data = signupSchema.parse(req.body);
    const passwordHash = await hashPassword(data.password);
    try {
      const user = await User.create({ name: data.name, email: data.email, passwordHash });
      await startSession(String(user._id), res); res.status(201).json({ user: publicUser(user) });
    } catch (error: any) { if (error.code === 11000) throw new HttpError(409, 'An account with this email already exists.'); throw error; }
  }));
  app.post('/api/auth/login', asyncRoute(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = await User.findOne({ email: data.email }).select('+passwordHash');
    const valid = await verifyPassword(data.password, user?.passwordHash || await dummyHash);
    if (!user || !valid) throw new HttpError(401, 'Email or password is incorrect.');
    await startSession(String(user._id), res); res.json({ user: publicUser(user) });
  }));
  app.use('/api', (req, res, next) => { void (async () => {
    const cookie = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith('vocaloop_session='));
    const token = cookie?.slice('vocaloop_session='.length);
    if (!token || !/^[\w-]{43}$/.test(token)) throw new HttpError(401, 'Please sign in to continue.');
    const session = await Session.findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } });
    if (!session) throw new HttpError(401, 'Your session expired. Please sign in again.');
    const user = await User.findById(session.userId);
    if (!user) throw new HttpError(401, 'Please sign in to continue.');
    res.locals.userId = String(user._id); res.locals.user = publicUser(user); res.locals.sessionId = session._id;
  })().then(() => next()).catch(next); });
  app.get('/api/auth/me', (_req, res) => res.json({ user: res.locals.user }));
  app.post('/api/auth/logout', asyncRoute(async (_req, res) => {
    await Session.deleteOne({ _id: res.locals.sessionId }); res.clearCookie('vocaloop_session', cookieOptions); res.json({ ok: true });
  }));
  app.get('/api/daily/status', asyncRoute(async (_req, res) => res.json(await dailyStatus(res.locals.userId))));
  app.get('/api/reviews/due', asyncRoute(async (_req, res) => {
    const cards = await UserWordProgress.find({ userId: res.locals.userId, nextReviewDate: { $lte: endOfUtcDay() } }).populate('wordId').sort({ nextReviewDate: 1, _id: 1 });
    res.json({ cards: cards.map(serializeProgress) });
  }));
  app.post('/api/reviews/submit', asyncRoute(async (req, res) => {
    const data = reviewSchema.parse(req.body); const userId = res.locals.userId;
    let claim: any;
    try {
      claim = await ReviewSubmission.findOneAndUpdate({ userId, submissionId: data.submissionId }, {
        $setOnInsert: { userId, submissionId: data.submissionId, progressId: data.progressId, rating: data.rating },
      }, { upsert: true, returnDocument: 'after' }).lean();
    } catch (error: any) { if (error.code !== 11000) throw error; claim = await ReviewSubmission.findOne({ userId, submissionId: data.submissionId }).lean(); }
    if (!claim || String(claim.progressId) !== data.progressId || claim.rating !== data.rating) throw new HttpError(409, 'Submission identifier was already used for another review.');
    if (claim.result) {
      if (await pendingReviews(userId) === 0) await completeDay(userId);
      res.json({ progress: claim.result, status: await dailyStatus(userId) }); return;
    }
    const previous: any = await UserWordProgress.findOne({ userId, 'reviewReceipts.submissionId': data.submissionId }).lean();
    if (previous) {
      const receipt = previous.reviewReceipts.find((item: any) => item.submissionId === data.submissionId);
      if (String(previous._id) !== data.progressId || receipt.rating !== data.rating) throw new HttpError(409, 'Submission identifier was already used for another review.');
      await ReviewSubmission.updateOne({ _id: claim._id }, { $set: { result: receipt.result } });
      if (await pendingReviews(userId) === 0) await completeDay(userId);
      res.json({ progress: receipt.result, status: await dailyStatus(userId) }); return;
    }
    const progress: any = await UserWordProgress.findOne({ _id: data.progressId, userId }).lean();
    if (!progress) throw new HttpError(404, 'Review card was not found.');
    const racedReceipt = progress.reviewReceipts?.find((item: any) => item.submissionId === data.submissionId);
    if (racedReceipt) {
      if (racedReceipt.rating !== data.rating) throw new HttpError(409, 'Submission identifier was already used for another review.');
      await ReviewSubmission.updateOne({ _id: claim._id }, { $set: { result: racedReceipt.result } });
      if (await pendingReviews(userId) === 0) await completeDay(userId);
      res.json({ progress: racedReceipt.result, status: await dailyStatus(userId) }); return;
    }
    if (progress.nextReviewDate > endOfUtcDay()) throw new HttpError(409, 'This card has already been reviewed today.');
    const now = new Date();
    const repeating = progress.pendingReviewDate && progress.pendingReviewDate > endOfUtcDay(now);
    const scheduled = repeating ? { interval: progress.interval, easeFactor: progress.easeFactor, repetitions: progress.repetitions, nextReviewDate: progress.pendingReviewDate } : scheduleReview(progress, data.rating, now);
    const nextReviewDate = data.rating <= 2 ? now : scheduled.nextReviewDate;
    const mastery = masteryLevel(scheduled.repetitions, scheduled.interval);
    let result = { id: data.progressId, ...scheduled, nextReviewDate, mastery: mastery.toLowerCase() };
    const update: any = { $set: { ...scheduled, nextReviewDate, mastery, lastReviewedAt: now },
      $inc: { __v: 1, totalReviews: 1, successfulReviews: data.rating >= 2 ? 1 : 0 },
      $push: { reviewReceipts: { $each: [{ submissionId: data.submissionId, rating: data.rating, result }], $slice: -100 } } };
    if (data.rating <= 2) update.$set.pendingReviewDate = scheduled.nextReviewDate;
    else update.$unset = { pendingReviewDate: 1 };
    const updated = await UserWordProgress.collection.findOneAndUpdate({ _id: progress._id, userId: progress.userId, __v: progress.__v }, update, { returnDocument: 'after' });
    if (!updated) {
      const retry: any = await UserWordProgress.findOne({ _id: progress._id, 'reviewReceipts.submissionId': data.submissionId }).lean();
      const receipt = retry?.reviewReceipts.find((item: any) => item.submissionId === data.submissionId);
      if (!receipt || receipt.rating !== data.rating) throw new HttpError(409, 'This review changed in another session. Refresh and retry.');
      result = receipt.result;
    }
    await ReviewSubmission.updateOne({ _id: claim._id }, { $set: { result } });
    if (await pendingReviews(userId) === 0) await completeDay(userId);
    res.json({ progress: result, status: await dailyStatus(userId) });
  }));
  app.get('/api/words/daily-new', asyncRoute(async (req, res) => {
    if (req.headers['sec-fetch-mode'] === 'navigate') throw new HttpError(403, 'Open your daily words inside VocaLoop.');
    res.json(await acquireDaily(res.locals.userId));
  }));
  app.get('/api/vault', asyncRoute(async (req, res) => {
    const query = z.object({ q: z.string().max(80).optional(), mastery: z.enum(['learning', 'familiar', 'mastered']).optional() }).strict().parse(req.query);
    const filter: any = { userId: res.locals.userId };
    if (query.mastery) filter.mastery = query.mastery[0]!.toUpperCase() + query.mastery.slice(1);
    const cards = await UserWordProgress.find(filter).populate('wordId').sort({ createdAt: -1 });
    const needle = query.q?.toLowerCase().trim();
    res.json({ cards: cards.map(serializeProgress).filter(card => !needle || `${card.word.word} ${card.word.definition}`.toLowerCase().includes(needle)) });
  }));
  app.get('/api/stats', asyncRoute(async (_req, res) => {
    const cards = await UserWordProgress.find({ userId: res.locals.userId }).lean();
    const reviewCount = cards.reduce((sum, card) => sum + card.totalReviews, 0);
    const successes = cards.reduce((sum, card) => sum + card.successfulReviews, 0);
    const status = await dailyStatus(res.locals.userId);
    const since = new Date(); since.setUTCDate(since.getUTCDate() - 6); since.setUTCHours(0, 0, 0, 0);
    const events = await ReviewSubmission.find({ userId: res.locals.userId, reviewedAt: { $gte: since }, result: { $exists: true } }).lean();
    const retentionHistory = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(since); day.setUTCDate(day.getUTCDate() + index);
      const date = day.toISOString().slice(0, 10);
      const dayEvents = events.filter(event => event.reviewedAt.toISOString().slice(0, 10) === date);
      return { date, reviews: dayEvents.length, retention: dayEvents.length ? Math.round(dayEvents.filter(event => event.rating >= 2).length / dayEvents.length * 100) : null };
    });
    res.json({ totalWords: cards.length, learning: cards.filter(card => card.mastery === 'Learning').length,
      familiar: cards.filter(card => card.mastery === 'Familiar').length, mastered: cards.filter(card => card.mastery === 'Mastered').length,
      retention: reviewCount ? Math.round(successes / reviewCount * 100) : 0, reviewCount, streak: status.streak, longestStreak: status.longestStreak, retentionHistory });
  }));
  app.use((_req, _res, next) => next(new HttpError(404, 'Endpoint was not found.')));
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) { res.status(400).json({ error: { message: 'Please check the submitted information.', fields: error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })) } }); return; }
    if (error instanceof HttpError) { res.status(error.status).json({ error: { message: error.message } }); return; }
    if (error.type === 'entity.parse.failed') { res.status(400).json({ error: { message: 'Invalid JSON body.' } }); return; }
    if (error.type === 'entity.too.large') { res.status(413).json({ error: { message: 'Request body is too large.' } }); return; }
    console.error('API request failed:', error.name, error.message); res.status(500).json({ error: { message: 'Something went wrong. Please retry.' } });
  });
  return app;
}
