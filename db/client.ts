import type { SQLiteBindParams } from 'expo-sqlite';
import * as SQLite from 'expo-sqlite';
import type { Middleware, NextFn, QueryContext } from './types';

class DBClient {
  private db!: SQLite.SQLiteDatabase;
  private middlewares: Middleware[] = [];

  async init(dbName: string) {
    this.db = await SQLite.openDatabaseAsync(dbName);
  }

  use(mw: Middleware) {
    this.middlewares.push(mw);
  }

  private async dispatch(ctx: QueryContext, core: NextFn) {
    // build the chain: mw1(ctx, mw2(ctx, mw3(ctx, core)))
    const chain = this.middlewares.reduceRight<NextFn>(
      (next, mw) => (c) => mw(c, next),
      core
    );
    return chain(ctx);
  }

  async runAsync(sql: string, params: SQLiteBindParams = []) {
    const ctx: QueryContext = { sql, params, type: 'run' };
    return this.dispatch(ctx, (c) => this.db.runAsync(c.sql, c.params ?? []));
  }

  async getFirstAsync<T>(sql: string, params: SQLiteBindParams = []): Promise<T | null> {
    const ctx: QueryContext = { sql, params, type: 'get' };
    return this.dispatch(ctx, (c) => this.db.getFirstAsync<T>(c.sql, c.params ?? []));
  }

  async getAllAsync<T>(sql: string, params: SQLiteBindParams = []): Promise<T[]> {
    const ctx: QueryContext = { sql, params, type: 'all' };
    return this.dispatch(ctx, (c) => this.db.getAllAsync<T>(c.sql, c.params ?? []));
  }

  async withTransactionAsync(fn: () => Promise<void>) {
    const ctx: QueryContext = { sql: '<transaction>', type: 'transaction' };
    return this.dispatch(ctx, () => this.db.withTransactionAsync(fn));
  }
}

export const db = new DBClient();