import path from 'path';
import fs from 'fs';

export type Row = Record<string, unknown>;

export interface DbClient {
  query(sql: string, params?: unknown[]): Promise<Row[]>;
  get(sql: string, params?: unknown[]): Promise<Row | undefined>;
  run(sql: string, params?: unknown[]): Promise<{ lastInsertRowid: number; changes: number }>;
}

let _client: DbClient | null = null;

export function getDb(): DbClient {
  if (_client) return _client;

  if (process.env.TURSO_DATABASE_URL) {
    // Production: async Turso / libSQL
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require('@libsql/client') as typeof import('@libsql/client');
    const turso = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    _client = {
      async query(sql, params) {
        const r = await turso.execute({ sql, args: (params ?? []) as import('@libsql/client').InValue[] });
        return r.rows as Row[];
      },
      async get(sql, params) {
        const r = await turso.execute({ sql, args: (params ?? []) as import('@libsql/client').InValue[] });
        return r.rows[0] as Row | undefined;
      },
      async run(sql, params) {
        const r = await turso.execute({ sql, args: (params ?? []) as import('@libsql/client').InValue[] });
        return { lastInsertRowid: Number(r.lastInsertRowid), changes: r.rowsAffected };
      },
    };
  } else {
    // Local development: synchronous node:sqlite wrapped in Promises
    const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
    const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'database', 'hp.db');
    const schemaPath = path.join(__dirname, '../../../database/schema.sql');

    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');

    if (fs.existsSync(schemaPath)) {
      db.exec(fs.readFileSync(schemaPath, 'utf-8'));
    }

    _client = {
      async query(sql, params) {
        return db.prepare(sql).all(...(params ?? [])) as Row[];
      },
      async get(sql, params) {
        return db.prepare(sql).get(...(params ?? [])) as Row | undefined;
      },
      async run(sql, params) {
        const r = db.prepare(sql).run(...(params ?? []));
        return { lastInsertRowid: Number(r.lastInsertRowid), changes: r.changes };
      },
    };
  }

  return _client;
}
