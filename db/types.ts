import type { SQLiteBindParams } from "expo-sqlite";

export type QueryContext = {
  sql: string;
  params?: SQLiteBindParams;
  type: 'run' | 'get' | 'all' | 'exec' | 'transaction';
};

export type NextFn = (ctx: QueryContext) => Promise<any>;
export type Middleware = (ctx: QueryContext, next: NextFn) => Promise<any>;