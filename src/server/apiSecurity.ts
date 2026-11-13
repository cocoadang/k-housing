import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

/** Costly or administrative operations are available only to trusted server callers. */
export function requireOperator(secret: () => string | undefined): RequestHandler {
  return (req, res, next) => {
    const expected = secret();
    if (!expected) { res.status(503).json({ success: false, error: { code: 'OPERATOR_API_DISABLED' } }); return; }
    const supplied = req.get('authorization') || '';
    const a = Buffer.from(supplied);
    const b = Buffer.from(`Bearer ${expected}`);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } }); return;
    }
    next();
  };
}
