import mongoose, { Schema } from 'mongoose';
import { UserWordProgress } from '../models';

const sessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true });
export const Session = mongoose.model('Session', sessionSchema);
const submissionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  submissionId: { type: String, required: true },
  progressId: { type: Schema.Types.ObjectId, required: true },
  rating: { type: Number, required: true },
  result: Schema.Types.Mixed,
  reviewedAt: { type: Date, default: Date.now, required: true },
});
submissionSchema.index({ userId: 1, submissionId: 1 }, { unique: true });
submissionSchema.index({ userId: 1, reviewedAt: 1 });
export const ReviewSubmission = mongoose.model('ReviewSubmission', submissionSchema);

// Scheduling and the replay receipt share one atomic document update. Keep the
// most recent 100 submissions per card; older retries cannot advance a future card.
UserWordProgress.schema.add({
  pendingReviewDate: { type: Date },
  reviewReceipts: { type: [new Schema({ submissionId: String, rating: Number, result: Schema.Types.Mixed }, { _id: false })], default: [] },
});
