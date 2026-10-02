import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import mongoose from 'mongoose';
import { createApp } from '../src/app';
import { User, Word, UserWordProgress, Streak } from '../src/models';
import { Session, ReviewSubmission } from '../src/http/models';
import { seedWords } from '../src/scripts/seed';
import { utcDay } from '../src/lib/srs';

test('authenticated daily habit API integrates with MongoDB', { timeout: 60000 }, async t => {
  const temp = await mkdtemp(join(tmpdir(), 'lexiq-api-'));
  const testDatabaseId = randomUUID().replaceAll('-', '');
  const probe = createServer().listen(0, '127.0.0.1'); await once(probe, 'listening');
  const mongoPort = (probe.address() as any).port; await new Promise<void>(resolve => probe.close(() => resolve()));
  let binaryMissing = false;
  const mongo = process.env.MONGO_TEST_URI ? undefined : spawn('mongod', ['--dbpath', temp, '--port', String(mongoPort), '--bind_ip', '127.0.0.1', '--quiet'], { stdio: 'ignore' });
  mongo?.on('error', () => { binaryMissing = true; });
  let server: ReturnType<ReturnType<typeof createApp>['listen']> | undefined;
  t.after(async () => {
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (mongo && mongo.exitCode === null && !binaryMissing) { const exited = once(mongo, 'exit'); mongo.kill('SIGTERM'); await exited; }
    await rm(temp, { recursive: true, force: true });
  });
  let connected = false;
  for (let attempt = 0; attempt < 30 && !connected; attempt++) {
    if (binaryMissing) throw new Error('API tests need mongod on PATH or MONGO_TEST_URI pointing at an isolated test database.');
    try { await mongoose.connect(process.env.MONGO_TEST_URI || `mongodb://127.0.0.1:${mongoPort}`, { serverSelectionTimeoutMS: 300, dbName: `lexiq_test_${testDatabaseId}` }); connected = true; }
    catch { await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  assert.ok(connected, 'temporary MongoDB starts');
  await Promise.all([User.init(), Word.init(), UserWordProgress.init(), Streak.init(), Session.init(), ReviewSubmission.init()]);
  await seedWords();
  server = createApp().listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  let cookie = '';
  async function request(path: string, body?: unknown, customCookie = cookie, headers: Record<string, string> = {}) {
    const response = await fetch(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(customCookie ? { Cookie: customCookie } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { response, data: await response.json() as any };
  }
  await t.test('authentication validates input and uses private cookie session', async () => {
    assert.equal((await request('/api/daily/status')).response.status, 401);
    const invalid = await request('/api/auth/signup', { name: 'Ada', email: 'bad', password: 'short' });
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.data.error.message, 'Controlla i dati inseriti.');
    assert.ok(invalid.data.error.fields.every((field: any) => !field.message.includes('Too small')));
    for (const target of [0, 21, 2.5, '5']) {
      assert.equal((await request('/api/auth/signup', { name: 'Ada', email: 'ada@example.com', password: 'correct horse battery', dailyTarget: target })).response.status, 400);
    }
    const signup = await request('/api/auth/signup', { name: 'Ada', email: 'ADA@example.com', password: 'correct horse battery' });
    assert.equal(signup.response.status, 201); assert.equal(signup.data.user.email, 'ada@example.com');
    assert.equal(signup.data.user.passwordHash, undefined); assert.equal(signup.data.user.dailyTarget, 4);
    const setCookie = signup.response.headers.get('set-cookie')!;
    assert.match(setCookie, /^lexiq_session=/);
    assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /SameSite=Lax/);
    if (process.env.COOKIE_SECURE !== 'true') assert.doesNotMatch(setCookie, /; Secure/);
    cookie = setCookie.split(';')[0]!;
    assert.equal((await request('/api/auth/me')).data.user.name, 'Ada');
    assert.equal((await request('/api/auth/login', { email: 'ada@example.com', password: 'wrong' })).response.status, 401);
    assert.equal((await request('/api/reviews/submit', {}, cookie, { Origin: 'https://evil.example' })).response.status, 403);
    for (const allowed of ['http://100.96.72.20:3000', 'http://localhost:3000', 'http://localhost:5173']) {
      const result = await request('/api/daily/status', undefined, cookie, { Origin: allowed });
      assert.equal(result.response.status, 200);
      assert.equal(result.response.headers.get('access-control-allow-origin'), allowed);
    }
  });
  await t.test('daily selection is stable and only seen words are acquired', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => request('/api/words/daily-new')));
    for (const result of results) { assert.equal(result.response.status, 200); assert.equal(result.data.words.length, 4); }
    assert.deepEqual(results[0]!.data.words.map((word: any) => word.id), results[4]!.data.words.map((word: any) => word.id));
    const status = (await request('/api/daily/status')).data;
    assert.equal(status.pendingReviews, 0); assert.equal(status.acquiredToday, 0); assert.equal(status.streak, 0);
    assert.equal(status.completedToday, false); assert.equal(status.dailyLimit, 4);
    assert.equal((await request('/api/vault')).data.cards.length, 0);
    const selected = results[0]!.data.words;
    const outsider = await Word.findOne({ _id: { $nin: selected.map((word: any) => word.id) } });
    assert.equal((await request('/api/words/seen', { wordId: String(outsider!._id) })).response.status, 403);
    const viewed = await Promise.all(Array.from({ length: 8 }, () => request('/api/words/seen', { wordId: selected[0].id })));
    for (const result of viewed) { assert.equal(result.response.status, 200); assert.equal(result.data.status.acquiredToday, 1); }
    assert.equal((await request('/api/vault')).data.cards.length, 1);
    assert.equal((await request('/api/reviews/due')).data.cards.length, 0);
    assert.equal((await request('/api/daily/status')).data.streak, 0);
    const resumed = (await request('/api/words/daily-new')).data;
    assert.deepEqual(resumed.seenIds, [selected[0].id]);
    for (const word of selected.slice(1)) await request('/api/words/seen', { wordId: word.id });
    const completed = (await request('/api/daily/status')).data;
    assert.equal(completed.acquiredToday, 4); assert.equal(completed.streak, 1); assert.equal(completed.completedToday, true);
    assert.equal((await request('/api/vault')).data.cards.length, 4);
  });
  let cards: any[] = [];
  await t.test('daily gate excludes new words until reviews complete', async () => {
    await UserWordProgress.updateMany({}, { $set: { nextReviewDate: new Date(Date.now() - 86400000) } });
    cards = (await request('/api/reviews/due')).data.cards;
    assert.equal(cards.length, 4); assert.equal((await request('/api/daily/status')).data.newWordsUnlocked, false);
    assert.equal((await request('/api/words/daily-new')).response.status, 423);
    assert.equal((await request('/api/reviews/submit', { progressId: cards[0].id, rating: 5, submissionId: randomUUID() })).response.status, 400);
  });
  await t.test('Again and Hard remain due; retry grades do not multiply intervals', async () => {
    for (const [card, grade] of [[cards[0], 1], [cards[1], 2]] as const) {
      const first = await request('/api/reviews/submit', { progressId: card.id, rating: grade, submissionId: randomUUID() });
      assert.equal(first.response.status, 200);
      assert.equal((await request('/api/reviews/due')).data.cards.some((item: any) => item.id === card.id), true);
      assert.equal((await request('/api/words/daily-new')).response.status, 423);
      const retry = await request('/api/reviews/submit', { progressId: card.id, rating: 3, submissionId: randomUUID() });
      assert.equal(retry.data.progress.repetitions, first.data.progress.repetitions);
      assert.equal(retry.data.progress.easeFactor, first.data.progress.easeFactor);
      assert.equal((await request('/api/reviews/due')).data.cards.some((item: any) => item.id === card.id), false);
    }
  });
  await t.test('review replay and racing submissions update exactly once', async () => {
    const payload = { progressId: cards[2].id, rating: 3, submissionId: randomUUID() };
    const results = await Promise.all(Array.from({ length: 10 }, () => request('/api/reviews/submit', payload)));
    for (const result of results) { assert.equal(result.response.status, 200); assert.deepEqual(result.data.progress, results[0]!.data.progress); }
    assert.equal((await UserWordProgress.findById(cards[2].id))!.totalReviews, 1);
    assert.equal((await request('/api/reviews/submit', { ...payload, rating: 4 })).response.status, 409);
    const racing = await Promise.all([3, 4].map(rating => request('/api/reviews/submit', { progressId: cards[3].id, rating, submissionId: randomUUID() })));
    assert.deepEqual(racing.map(item => item.response.status).sort(), [200, 409]);
    assert.equal((await request('/api/daily/status')).data.pendingReviews, 0);
    assert.equal((await request('/api/daily/status')).data.streak, 1);
    assert.equal((await request('/api/stats')).data.reviewCount, 6);
    const history = (await request('/api/stats')).data.retentionHistory;
    assert.equal(history.length, 7); assert.equal(history[6].reviews, 6); assert.equal(history[0].retention, null);
  });
  await t.test('simultaneous cross-card UUID reuse is rejected and same-host origins work', async () => {
    await UserWordProgress.updateMany({ _id: { $in: [cards[0].id, cards[1].id] } }, { $set: { nextReviewDate: new Date() } });
    const submissionId = randomUUID();
    const results = await Promise.all([cards[0], cards[1]].map(card => request('/api/reviews/submit', { progressId: card.id, rating: 3, submissionId })));
    assert.deepEqual(results.map(item => item.response.status).sort(), [200, 409]);
    assert.equal((await request('/api/daily/status', undefined, cookie, { Origin: origin })).response.status, 200);
    for (const card of (await request('/api/reviews/due')).data.cards) await request('/api/reviews/submit', { progressId: card.id, rating: 3, submissionId: randomUUID() });
  });
  await t.test('ownership and cookie revocation protect progress', async () => {
    const other = await request('/api/auth/signup', { name: 'Grace', email: 'grace@example.com', password: 'correct horse battery' }, '');
    const otherCookie = other.response.headers.get('set-cookie')!.split(';')[0]!;
    assert.equal((await request('/api/reviews/submit', { progressId: cards[0].id, rating: 3, submissionId: randomUUID() }, otherCookie)).response.status, 404);
    assert.equal((await request('/api/auth/logout', {}, otherCookie)).response.status, 200);
    assert.equal((await request('/api/auth/me', undefined, otherCookie)).response.status, 401);
  });
  await t.test('streak breaks on missed UTC days and resumes once per day', async () => {
    const user = await User.findOne({ email: 'ada@example.com' });
    await Streak.updateOne({ userId: user!._id }, { $set: { currentStreak: 7, longestStreak: 9, lastCompletedDay: utcDay(new Date(Date.now() - 3 * 86400000)) } });
    assert.equal((await request('/api/daily/status')).data.streak, 0);
    const selection = (await request('/api/words/daily-new')).data;
    const status = (await request('/api/words/seen', { wordId: selection.words[0].id })).data.status;
    assert.equal(status.streak, 1); assert.equal(status.longestStreak, 9);
  });
  await t.test('custom daily targets persist and viewing never exceeds the reserved quota', async () => {
    for (const target of [1, 5, 20]) {
      const account = await request('/api/auth/signup', { name: 'Target', email: `target${target}@example.com`, password: 'correct horse battery', dailyTarget: target }, '');
      assert.equal(account.response.status, 201);
      const session = account.response.headers.get('set-cookie')!.split(';')[0]!;
      assert.equal((await request('/api/auth/me', undefined, session)).data.user.dailyTarget, target);
      const selection = (await request('/api/words/daily-new', undefined, session)).data;
      assert.equal(selection.words.length, target); assert.equal(selection.status.dailyLimit, target);
      const views = await Promise.all(selection.words.flatMap((word: any) => Array.from({ length: 3 }, () => request('/api/words/seen', { wordId: word.id }, session))));
      for (const result of views) assert.equal(result.response.status, 200);
      const status = (await request('/api/daily/status', undefined, session)).data;
      assert.equal(status.acquiredToday, target); assert.equal(status.streak, 1);
      assert.equal((await request('/api/vault', undefined, session)).data.cards.length, target);
      assert.equal((await request('/api/reviews/due', undefined, session)).data.cards.length, 0);
      const repeated = (await request('/api/words/daily-new', undefined, session)).data;
      assert.deepEqual(repeated.words.map((word: any) => word.id), selection.words.map((word: any) => word.id));
      const card = (await request('/api/vault', undefined, session)).data.cards[0];
      assert.equal((await request('/api/reviews/submit', { progressId: card.id, rating: 3, submissionId: randomUUID() }, session)).response.status, 409);
      assert.equal((await request('/api/stats', undefined, session)).data.reviewCount, 0);
    }
  });
  await t.test('catalog is local, attributed and repeated imports preserve editorial changes', async () => {
    assert.ok(await Word.countDocuments() > 20000);
    const apple = await Word.findOne({ term: 'apple' });
    assert.ok(apple); assert.equal(apple.source, 'wiktionary'); assert.equal(apple.definition, 'mela');
    assert.equal(apple.level, undefined); assert.match(apple.audioUrl!, /^https:\/\/upload.wikimedia.org\//);
    await Word.updateOne({ _id: apple._id }, { $set: { definition: 'Mela: frutto del melo.' } });
    await seedWords();
    assert.equal((await Word.findById(apple._id))!.definition, 'Mela: frutto del melo.');
  });

});
