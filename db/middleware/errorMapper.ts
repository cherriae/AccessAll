import type { Middleware } from '../types';

export const errorMapper: Middleware = async (ctx, next) => {
  try {
    return await next(ctx);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      throw new Error('DUPLICATE_ENTRY');
    }
    throw err;
  }
};