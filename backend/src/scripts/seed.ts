import 'dotenv/config';
import mongoose from 'mongoose';
import { Word } from '../models';
import { words } from '../data/words';

export async function seedWords() {
  await Word.bulkWrite(words.map(word => ({ updateOne: { filter: { term: word.term }, update: { $set: word }, upsert: true } })));
  await Word.createIndexes();
  console.log(`Seeded ${words.length} vocabulary words.`);
}

if (require.main === module) {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lexiq_db';
  mongoose.connect(uri).then(seedWords).catch(error => { console.error('Seed failed:', error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
}
