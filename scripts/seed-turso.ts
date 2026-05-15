/**
 * seed-turso.ts
 * Kopierar hela lokala SQLite-databasen (database/hp.db) till Turso.
 * Kör EFTER npm run scrape:
 *   npx ts-node --project tsconfig.base.json scripts/seed-turso.ts
 *
 * Kräver TURSO_DATABASE_URL och TURSO_AUTH_TOKEN i .env.
 */

import 'dotenv/config';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@libsql/client';

const BATCH_SIZE = 50;

async function main() {
  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'database', 'hp.db');
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl) {
    console.error('Fel: TURSO_DATABASE_URL saknas i .env');
    process.exit(1);
  }

  console.log(`Läser från ${dbPath}...`);
  const local = new DatabaseSync(dbPath);
  const turso = createClient({ url: tursoUrl, authToken: tursoToken });

  // ── Schema ────────────────────────────────────────────────────────────────
  console.log('Skapar tabeller i Turso...');
  const schema = `
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term TEXT NOT NULL,
      year INTEGER NOT NULL,
      season TEXT NOT NULL,
      type TEXT NOT NULL,
      part TEXT,
      variant TEXT,
      source_url TEXT,
      facit_url TEXT,
      elf_url TEXT
    );
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES exams(id),
      question_number INTEGER NOT NULL,
      section TEXT NOT NULL,
      question_text TEXT NOT NULL,
      option_a TEXT, option_b TEXT, option_c TEXT, option_d TEXT, option_e TEXT,
      correct_answer TEXT,
      difficulty INTEGER DEFAULT 3
    );
    CREATE TABLE IF NOT EXISTS user_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES questions(id),
      selected_answer TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      time_spent_seconds INTEGER DEFAULT 0,
      answered_at TEXT NOT NULL DEFAULT (datetime('now')),
      mode TEXT DEFAULT 'övning'
    );
    CREATE TABLE IF NOT EXISTS saved_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES questions(id) UNIQUE,
      note TEXT,
      saved_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `;
  for (const stmt of schema.split(';').map(s => s.trim()).filter(Boolean)) {
    await turso.execute(stmt);
  }

  // ── Exams ─────────────────────────────────────────────────────────────────
  const exams = local.prepare('SELECT * FROM exams').all() as Record<string, unknown>[];
  console.log(`Migrerar ${exams.length} prov...`);
  for (let i = 0; i < exams.length; i += BATCH_SIZE) {
    const batch = exams.slice(i, i + BATCH_SIZE);
    await turso.batch(batch.map(e => ({
      sql: `INSERT OR REPLACE INTO exams (id,term,year,season,type,part,variant,source_url,facit_url,elf_url)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [e.id, e.term, e.year, e.season, e.type, e.part ?? null, e.variant ?? null,
             e.source_url ?? null, e.facit_url ?? null, e.elf_url ?? null],
    })));
  }

  // ── Questions ─────────────────────────────────────────────────────────────
  const questions = local.prepare('SELECT * FROM questions').all() as Record<string, unknown>[];
  console.log(`Migrerar ${questions.length} frågor...`);
  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);
    await turso.batch(batch.map(q => ({
      sql: `INSERT OR REPLACE INTO questions
            (id,exam_id,question_number,section,question_text,option_a,option_b,option_c,option_d,option_e,correct_answer,difficulty)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [q.id, q.exam_id, q.question_number, q.section, q.question_text,
             q.option_a ?? null, q.option_b ?? null, q.option_c ?? null, q.option_d ?? null, q.option_e ?? null,
             q.correct_answer ?? null, q.difficulty ?? 3],
    })));
    if (i % 500 === 0) console.log(`  ${i + batch.length}/${questions.length} frågor...`);
  }

  console.log('\nMigrering klar!');
  console.log(`  Prov: ${exams.length}`);
  console.log(`  Frågor: ${questions.length}`);
  local.close();
}

main().catch(err => { console.error('Migreringfel:', err); process.exit(1); });
