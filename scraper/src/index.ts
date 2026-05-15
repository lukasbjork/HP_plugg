/**
 * Huvudskript för scraping-pipelinen.
 * Kör: npm run scrape (från projektets rot)
 *
 * Ordning:
 *   1. Hämta provlista från hogskoleprovet.nu
 *   2. Ladda ner PDF-filer lokalt
 *   3. Extrahera frågor och facit
 *   4. Fyll SQLite-databasen
 *   5. Skriv ut sammanfattning
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import Anthropic from '@anthropic-ai/sdk';

import { fetchExamList } from './fetchExamList.js';
import { downloadPDFs } from './downloadPDFs.js';
import { seedDatabase } from './seedDatabase.js';

// ESM-kompatibel __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  HP-Scraper — Högskoleprovets studiewebbplats');
  console.log('═══════════════════════════════════════════════════\n');

  // ── 1. Validera konfiguration ──────────────────────────────────────────────
  const dbPath = process.env.DATABASE_PATH ?? path.join(__dirname, '../../../database/hp.db');
  const downloadDir = process.env.PDF_DOWNLOAD_DIR ?? path.join(__dirname, '../../../.tmp/pdfs');

  // Skapa kataloger om de saknas
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.mkdirSync(downloadDir, { recursive: true });

  // Valfri Anthropic-klient för Vision-fallback
  let anthropic: Anthropic | undefined;
  if (process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    console.log('[INIT] Anthropic Claude Vision-fallback aktiverad');
  } else {
    console.log('[INIT] Ingen ANTHROPIC_API_KEY — Vision-fallback inaktiverad');
  }

  // ── 2. Hämta provlista ─────────────────────────────────────────────────────
  console.log('\n[STEG 1/4] Hämtar provlista från hogskoleprovet.nu...');
  let exams;
  try {
    exams = await fetchExamList();
    console.log(`[STEG 1/4] ✓ Hittade ${exams.length} provtillfällen\n`);
  } catch (err) {
    console.error('[STEG 1/4] ✗ Kunde inte hämta provlistan:', err);
    process.exit(1);
  }

  // ── 3. Ladda ner PDF:er ────────────────────────────────────────────────────
  console.log('[STEG 2/4] Laddar ner PDF-filer...');
  let pdfPaths: Map<string, string>;
  try {
    pdfPaths = await downloadPDFs(exams, downloadDir);
    console.log(`\n[STEG 2/4] ✓ ${pdfPaths.size} PDF:er nedladdade till ${downloadDir}\n`);
  } catch (err) {
    console.error('[STEG 2/4] ✗ Fel vid nedladdning:', err);
    process.exit(1);
  }

  // ── 4. Öppna databas ───────────────────────────────────────────────────────
  console.log('[STEG 3/4] Initierar databas...');
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');

    // Kör schema.sql
    const schemaPath = path.join(__dirname, '../../../database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      db.exec(schema);
      console.log(`[STEG 3/4] ✓ Databas initierad: ${dbPath}\n`);
    } else {
      console.warn('[STEG 3/4] ⚠ schema.sql hittades inte — tabellerna skapas automatiskt av seedDatabase');
    }
  } catch (err) {
    console.error('[STEG 3/4] ✗ Kunde inte öppna databasen:', err);
    process.exit(1);
  }

  // ── 5. Fyll databasen ─────────────────────────────────────────────────────
  console.log('[STEG 4/4] Extraherar frågor och fyller databasen...');
  try {
    await seedDatabase(db, exams, pdfPaths, anthropic);
    console.log('\n[STEG 4/4] ✓ Databasen fylld');
  } catch (err) {
    console.error('[STEG 4/4] ✗ Fel vid databaspopulering:', err);
    process.exit(1);
  }

  db.close?.();
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Scraping klar! Starta appen med: npm run dev');
  console.log('═══════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Oväntat fel:', err);
  process.exit(1);
});
