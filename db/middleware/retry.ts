import type { Middleware } from '../types';

export const retry = (attempts = 3): Middleware => async (ctx, next) => {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await next(ctx);
    } catch (err: any) {
      lastErr = err;
      // e.g. retry only on "database is locked"
      if (!String(err.message).includes('locked')) throw err;
      await new Promise((r) => setTimeout(r, 50 * (i + 1)));
    }
  }
  throw lastErr;
};