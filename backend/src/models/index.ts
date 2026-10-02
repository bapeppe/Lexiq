import mongoose, { Schema } from 'mongoose';

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, maxlength: 80 },
  passwordHash: { type: String, required: true, select: false },
  dailyTarget: { type: Number, default: 4, min: 1, max: 20 },
}, { timestamps: true });

const wordSchema = new Schema({
  term: { type: String, required: true, unique: true },
  level: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], default: undefined },
  ipa: { type: String, default: '' },
  partOfSpeech: { type: String, required: true },
  definition: { type: String, required: true },
  context: { type: String, default: '' },
  collocations: { type: [String], default: [] },
  senses: { type: [new Schema({ definition: String, partOfSpeech: String, ipa: String, context: String }, { _id: false })], default: [] },
  source: { type: String },
  sourceUrl: { type: String },
  license: { type: String },
  priority: { type: Number, default: 100 },
  audioUrl: { type: String },
  audioSourceUrl: { type: String },
  audioLicense: { type: String },
}, { timestamps: true });

wordSchema.index({ priority: 1, term: 1 });

const progressSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  wordId: { type: Schema.Types.ObjectId, ref: 'Word', required: true },
  interval: { type: Number, default: 0, min: 0 },
  easeFactor: { type: Number, default: 2.5, min: 1.3 },
  repetitions: { type: Number, default: 0, min: 0 },
  nextReviewDate: { type: Date, default: Date.now, required: true },
  lastReviewedAt: { type: Date },
  acquiredOn: { type: String, required: true },
  totalReviews: { type: Number, default: 0, min: 0 },
  successfulReviews: { type: Number, default: 0, min: 0 },
  mastery: { type: String, enum: ['Learning', 'Familiar', 'Mastered'], default: 'Learning' },
}, { timestamps: true, optimisticConcurrency: true });
progressSchema.index({ userId: 1, wordId: 1 }, { unique: true });
progressSchema.index({ userId: 1, nextReviewDate: 1 });
progressSchema.index({ wordId: 1 });
progressSchema.index({ userId: 1, acquiredOn: 1 });

const streakSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  currentStreak: { type: Number, default: 0, min: 0 },
  longestStreak: { type: Number, default: 0, min: 0 },
  lastCompletedDay: { type: String },
  dailyWordIds: { type: [Schema.Types.ObjectId], ref: 'Word', default: [] },
  acquisitionDay: { type: String },
}, { timestamps: true, optimisticConcurrency: true });

export const User = mongoose.model('User', userSchema);
export const Word = mongoose.model('Word', wordSchema);
export const UserWordProgress = mongoose.model('UserWordProgress', progressSchema);
export const Streak = mongoose.model('Streak', streakSchema);
