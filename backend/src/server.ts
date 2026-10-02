import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app';
import { seedWords } from './scripts/seed';
import { User, Word, UserWordProgress, Streak } from './models';
import { Session, ReviewSubmission } from './http/models';

async function start() {
  console.log('Lexiq API V2 in partenza...');
  const mongoUri = process.env.MONGO_URI || 'mongodb://admin:giuseppe20@mern-db:27017/lexiq_db?authSource=admin';
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  await seedWords();
  await Promise.all([User.init(), Word.init(), UserWordProgress.init(), Streak.init(), Session.init(), ReviewSubmission.init()]);
  const app = createApp();
  const port = Number(process.env.PORT || 5000);
  const server = app.listen(port, '0.0.0.0', () => console.log('Lexiq API V2 in partenza...'));
  async function shutdown() {
    server.close(async () => { await mongoose.disconnect(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
}
void start().catch(error => { console.error('Startup failed:', error.message); process.exit(1); });
