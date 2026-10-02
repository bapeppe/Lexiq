import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import type { RequestHandler } from 'express';

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':');
  if (!salt || !key || !/^[a-f0-9]{128}$/.test(key)) return false;
  return timingSafeEqual(await derive(password, salt), Buffer.from(key, 'hex'));
}
export function tokenHash(token: string): string { return createHash('sha256').update(token).digest('hex'); }

/** Per-process protection; bound memory and expire buckets even on low-traffic instances. */
export function rateLimit(limit: number, windowMs: number): RequestHandler {
  const buckets = new Map<string, { count: number; expires: number }>();
  return (req, res, next) => {
    const now = Date.now();
    if (buckets.size >= 10000) {
      for (const [key, value] of buckets) if (value.expires <= now) buckets.delete(key);
      if (buckets.size >= 10000) { res.status(429).json({ error: { message: 'Please try again shortly.' } }); return; }
    }
    const key = req.ip || 'unknown';
    let bucket = buckets.get(key);
    if (!bucket || bucket.expires <= now) { bucket = { count: 0, expires: now + windowMs }; buckets.set(key, bucket); }
    bucket.count++;
    if (bucket.count > limit) {
      res.setHeader('Retry-After', Math.ceil((bucket.expires - now) / 1000));
      res.status(429).json({ error: { message: 'Too many requests. Please try again later.' } }); return;
    }
    next();
  };
}
