import path from 'path';
import fs from 'fs';

const INLINE_SCHEMA = `
CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL, year INTEGER NOT NULL, season TEXT NOT NULL,
  type TEXT NOT NULL, part INTEGER NOT NULL, variant TEXT,
  source_url TEXT, facit_url TEXT, elf_url TEXT
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL, section TEXT NOT NULL,
  question_text TEXT NOT NULL,
  option_a TEXT, option_b TEXT, option_c TEXT, option_d TEXT, option_e TEXT,
  correct_answer TEXT, difficulty INTEGER DEFAULT NULL, page_ref INTEGER
);
CREATE TABLE IF NOT EXISTS user_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_answer TEXT NOT NULL, is_correct INTEGER NOT NULL,
  time_spent_seconds INTEGER, answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  mode TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS saved_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  note TEXT, saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_questions_section ON questions(section);
CREATE INDEX IF NOT EXISTS idx_user_answers_question ON user_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_date ON user_answers(answered_at);
CREATE INDEX IF NOT EXISTS idx_exams_term ON exams(term);
`;

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

    // Inline schema so it works in bundled Netlify functions without the SQL file
    const schema = fs.existsSync(schemaPath)
      ? fs.readFileSync(schemaPath, 'utf-8')
      : INLINE_SCHEMA;
    db.exec(schema);

    type SqlVal = string | number | null | bigint | Uint8Array;
    _client = {
      async query(sql, params) {
        return db.prepare(sql).all(...(params ?? []) as SqlVal[]) as Row[];
      },
      async get(sql, params) {
        return db.prepare(sql).get(...(params ?? []) as SqlVal[]) as Row | undefined;
      },
      async run(sql, params) {
        const r = db.prepare(sql).run(...(params ?? []) as SqlVal[]);
        return { lastInsertRowid: Number(r.lastInsertRowid), changes: Number(r.changes) };
      },
    };
  }

  return _client!;
}
