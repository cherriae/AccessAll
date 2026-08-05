import type { Middleware } from '../types';

export const logger: Middleware = async (ctx, next) => {
  const start = Date.now();
  try {
    const result = await next(ctx);
    console.log(`[SQL:${ctx.type}] ${ctx.sql} (${Date.now() - start}ms)`);
    return result;
  } catch (err) {
    console.error(`[SQL:${ctx.type} ERROR] ${ctx.sql}`, err);
    throw err;
  }
};