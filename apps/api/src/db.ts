import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

export type Db = pg.Pool;
export type Queryable = Pick<pg.Pool | pg.PoolClient, "query">;

export function createDb(url: string): Db {
  return new pg.Pool({ connectionString: url, max: 10 });
}

const MIGRATIONS = new URL("../migrations/", import.meta.url);

/** Applies migrations/*.sql in name order, each once, each in its own transaction. */
export async function migrate(db: Db): Promise<string[]> {
  await db.query(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const done = new Set(
    (await db.query<{ name: string }>("select name from schema_migrations")).rows.map(
      (r) => r.name,
    ),
  );
  const applied: string[] = [];
  for (const name of (await readdir(MIGRATIONS)).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(name)) continue;
    const sql = await readFile(new URL(name, MIGRATIONS), "utf8");
    await tx(db, async (c) => {
      await c.query(sql);
      await c.query("insert into schema_migrations (name) values ($1)", [name]);
    });
    applied.push(name);
  }
  return applied;
}

export async function tx<T>(db: Db, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await db.connect();
  try {
    await c.query("begin");
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (error) {
    await c.query("rollback");
    throw error;
  } finally {
    c.release();
  }
}
