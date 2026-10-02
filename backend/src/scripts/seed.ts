import 'dotenv/config';
import mongoose from 'mongoose';
import { Word } from '../models';
import { words } from '../data/words';

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required to seed the database');
  await mongoose.connect(uri);
  await Word.bulkWrite(words.map(word => ({ updateOne: { filter: { term: word.term }, update: { $set: word }, upsert: true } })));
  await Word.createIndexes();
  console.log(`Seeded ${words.length} vocabulary words.`);
}

seed().catch(error => { console.error('Seed failed:', error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
