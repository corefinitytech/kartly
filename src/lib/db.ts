import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env";
import * as schema from "@/db/schema";

// Speed notes (measured 2026-09-30, dev machine to Neon us-east-2 is ~250 ms per round trip):
// - Opening a connection costs ~2.5 s (TLS + auth). Parallel queries on a big
//   pool each open their own connection, so "parallel" was the slowest path.
// - postgres.js pipelines queries on one warm connection: 3 parallel queries
//   on one connection took 242 ms, the same as one.
// So: one shared client per process (Next dev reloads modules, which used to
// create a new pool, and new cold connections, per route), and a small pool.
// Transactions hold a connection, so production keeps a few.
// - Drizzle runs every query through postgres.js `unsafe()`, which defaults to
//   prepare: false. A parameterised unprepared query is Describe, wait, then
//   Execute: two round trips. Prepared, a repeat query is one. We default
//   unsafe() to prepared (also inside transactions), which halves DB time.
type Sql = ReturnType<typeof postgres>;
const globalForDb = globalThis as unknown as { kartlyPg?: Sql };

function preferPrepared<T extends Pick<Sql, "unsafe">>(sql: T): T {
  const unsafe = sql.unsafe.bind(sql);
  sql.unsafe = ((query: string, args?: unknown[], options?: { prepare?: boolean }) =>
    unsafe(query, args as never, { prepare: true, ...options })) as T["unsafe"];
  return sql;
}

function createClient(): Sql {
  const sql = preferPrepared(
    postgres(env.DATABASE_URL, {
      max: process.env.NODE_ENV === "production" ? 5 : 2,
      idle_timeout: 0,
      connect_timeout: 15,
    }),
  );
  const begin = sql.begin.bind(sql);
  sql.begin = ((...args: unknown[]) => {
    const fn = args[args.length - 1] as (tx: Sql) => unknown;
    const wrapped = (tx: Sql) => fn(preferPrepared(tx));
    return (begin as (...a: unknown[]) => unknown)(...args.slice(0, -1), wrapped);
  }) as Sql["begin"];
  return sql;
}

const client = globalForDb.kartlyPg ?? createClient();

if (process.env.NODE_ENV !== "production") globalForDb.kartlyPg = client;

export const db = drizzle(client, { schema });
export type Database = typeof db;
