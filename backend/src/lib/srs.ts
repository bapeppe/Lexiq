export type ReviewGrade = 1 | 2 | 3 | 4;
export interface SrsState {
  interval: number;
  easeFactor: number;
  repetitions: number;
}
export interface SrsResult extends SrsState {
  nextReviewDate: Date;
}

/** UI grades Again / Hard / Good / Easy map to SM-2 quality 1 / 3 / 4 / 5. */
export function scheduleReview(state: SrsState, grade: ReviewGrade, now = new Date()): SrsResult {
  if (![1, 2, 3, 4].includes(grade)) throw new RangeError('Grade must be 1–4');
  if (!Number.isFinite(now.getTime())) throw new RangeError('Invalid review date');
  if (!Number.isFinite(state.easeFactor) || state.easeFactor < 1.3 || !Number.isInteger(state.repetitions) || state.repetitions < 0 || !Number.isInteger(state.interval) || state.interval < 0) {
    throw new RangeError('Invalid SRS state');
  }
  const quality = [0, 1, 3, 4, 5][grade]!;
  const difference = 5 - quality;
  const easeFactor = Math.max(1.3, state.easeFactor + 0.1 - difference * (0.08 + difference * 0.02));
  const repetitions = quality < 3 ? 0 : state.repetitions + 1;
  const interval = repetitions <= 1 ? 1 : repetitions === 2 ? 6 : Math.max(1, Math.ceil(state.interval * state.easeFactor));
  const nextReviewDate = new Date(now);
  nextReviewDate.setUTCDate(nextReviewDate.getUTCDate() + interval);
  return { interval, easeFactor: Math.round(easeFactor * 10000) / 10000, repetitions, nextReviewDate };
}

export function masteryLevel(repetitions: number, interval: number): 'Learning' | 'Familiar' | 'Mastered' {
  return repetitions >= 5 && interval >= 21 ? 'Mastered' : repetitions >= 2 ? 'Familiar' : 'Learning';
}

/** All daily boundaries are UTC, consistently on the server and client. */
export function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function endOfUtcDay(date = new Date()): Date {
  const result = new Date(date);
  result.setUTCHours(23, 59, 59, 999);
  return result;
}
