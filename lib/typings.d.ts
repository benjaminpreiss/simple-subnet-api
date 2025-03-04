import pg from "pg";

export interface Logger {
  info: typeof console.info;
  error: typeof console.error;
  request: typeof console.info;
}

export type PgPool = pg.Pool;

export type Queryable = Pick<Pool, "query">;
export type UnknownRow = Record<string, unknown>;
export type QueryResultWithUnknownRows = pg.QueryResult<UnknownRow>;
