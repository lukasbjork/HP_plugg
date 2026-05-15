/**
 * Fyller SQLite-databasen med provtillfällen och frågor.
 * Matchar ihop extraherade frågor med svar från facit.
 */

import { DatabaseSync } from 'node:sqlite';
import Anthropic from '@anthropic-ai/sdk';
import type { ExamEntry, ParsedQuestion, FacitAnswer } from './types.js';
import { parseFacit } from './parseFacit.js';
import { extractQuestionsFromExam } from './extractQuestions.js';

// ---------------------------------------------------------------------------
// Hjälptyper
// ---------------------------------------------------------------------------

/** Intern representation av en exam-rad i databasen */
interface ExamRow {
  id: number;
  term: string;
  year: number;
  season: string;
  type: string;      // 'kvant' | 'verb'
  part: number;      // 1 eller 2
  variant: string | null;
  source_url: string | null;
  facit_url: string | null;
  elf_url: string | null;
}

/** Sektionsräknare för slutrapporten */
type SectionCounts = Record<string, number>;

// ---------------------------------------------------------------------------
// Databas-initiering
// ---------------------------------------------------------------------------

/**
 * Skapar tabellerna om de inte redan finns.
 * Schemat speglar database/schema.sql.
 */
function ensureSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exams (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      term        TEXT    NOT NULL,
      year        INTEGER NOT NULL,
      season      TEXT    NOT NULL,
      type        TEXT    NOT NULL,
      part        INTEGER NOT NULL,
      variant     TEXT,
      source_url  TEXT,
      facit_url   TEXT,
      elf_url     TEXT
    );

    CREATE TABLE IF NOT EXISTS questions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id         INTEGER NOT NULL REFERENCES exams(id),
      question_number INTEGER NOT NULL,
      section         TEXT    NOT NULL,
      question_text   TEXT    NOT NULL,
      option_a        TEXT,
      option_b        TEXT,
      option_c        TEXT,
      option_d        TEXT,
      option_e        TEXT,
      correct_answer  TEXT,
      difficulty      REAL,
      page_ref        INTEGER
    );
  `);
}

// ---------------------------------------------------------------------------
// Hjälpfunktioner
// ---------------------------------------------------------------------------

/**
 * Bygger en Map från frågans löpnummer till rätt svar,
 * baserat på en lista av FacitAnswer.
 */
function buildAnswerMap(answers: FacitAnswer[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const a of answers) {
    map.set(a.questionNumber, a.answer);
  }
  return map;
}

/**
 * Infogar en exam-rad och returnerar dess ID.
 */
function insertExam(
  db: DatabaseSync,
  entry: ExamEntry,
  type: 'kvant' | 'verb',
  part: 1 | 2,
  sourceUrl: string | null,
  facitUrl: string | null,
  elfUrl: string | null,
): number {
  const stmt = db.prepare(`
    INSERT INTO exams (term, year, season, type, part, variant, source_url, facit_url, elf_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    entry.term,
    entry.year,
    entry.season,
    type,
    part,
    entry.variant ?? null,
    sourceUrl,
    facitUrl,
    elfUrl,
  );

  return Number(result.lastInsertRowid);
}

/**
 * Infogar ett frågeobjekt i databasen.
 */
function insertQuestion(
  db: DatabaseSync,
  examId: number,
  question: ParsedQuestion,
  correctAnswer: string | null,
): void {
  const stmt = db.prepare(`
    INSERT INTO questions (
      exam_id, question_number, section, question_text,
      option_a, option_b, option_c, option_d, option_e,
      correct_answer, difficulty, page_ref
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
  `);

  stmt.run(
    examId,
    question.questionNumber,
    question.section,
    question.questionText,
    question.optionA ?? null,
    question.optionB ?? null,
    question.optionC ?? null,
    question.optionD ?? null,
    question.optionE ?? null,
    correctAnswer,
    question.pageRef ?? null,
  );
}

// ---------------------------------------------------------------------------
// Huvud-export
// ---------------------------------------------------------------------------

/**
 * Fyller databasen med alla exams och deras frågor.
 *
 * Flöde per provtillfälle:
 * 1. Parsa facit (om det finns)
 * 2. För varje prov-PDF (kvant1, kvant2, verb1, verb2):
 *    a. Extrahera frågor
 *    b. Matcha med svar från facit
 *    c. Infoga i databasen
 *
 * @param db         - SQLite-databasinstans
 * @param exams      - Lista av provtillfällen
 * @param pdfPaths   - Map från URL till lokal filsökväg
 * @param anthropic  - Valfri Anthropic-klient för Vision-fallback
 */
export async function seedDatabase(
  db: DatabaseSync,
  exams: ExamEntry[],
  pdfPaths: Map<string, string>,
  anthropic?: Anthropic,
): Promise<void> {
  // Se till att tabellerna finns
  ensureSchema(db);

  // Statistik för slutrapporten
  let totalExams = 0;
  let totalQuestions = 0;
  let examsWithoutFacit = 0;
  const sectionCounts: SectionCounts = {
    ORD: 0, LÄS: 0, MEK: 0, XYZ: 0, KVA: 0, NOG: 0, DTK: 0,
  };

  for (const exam of exams) {
    // Försök parsa facit
    let answerMap = new Map<number, string>();
    if (exam.urls.facit) {
      const facitPath = pdfPaths.get(exam.urls.facit);
      if (facitPath) {
        try {
          const answers = await parseFacit(facitPath);
          answerMap = buildAnswerMap(answers);
        } catch (err) {
          console.warn(`[DB] Kunde inte parsa facit för ${exam.term}: ${String(err)}`);
          examsWithoutFacit++;
        }
      } else {
        examsWithoutFacit++;
      }
    } else {
      examsWithoutFacit++;
    }

    // De fyra delarna med deras URL-nycklar
    const parts: Array<{ type: 'kvant' | 'verb'; part: 1 | 2; urlKey: keyof ExamEntry['urls'] }> = [
      { type: 'kvant', part: 1, urlKey: 'kvant1' },
      { type: 'kvant', part: 2, urlKey: 'kvant2' },
      { type: 'verb', part: 1, urlKey: 'verb1' },
      { type: 'verb', part: 2, urlKey: 'verb2' },
    ];

    for (const { type, part, urlKey } of parts) {
      const sourceUrl = exam.urls[urlKey] ?? null;
      if (!sourceUrl) continue;

      const pdfPath = pdfPaths.get(sourceUrl);
      if (!pdfPath) {
        console.log(`[DB] Hoppar över ${exam.term} ${type}${part} — PDF saknas lokalt`);
        continue;
      }

      try {
        // Extrahera frågor från PDF:en
        const questions = await extractQuestionsFromExam(pdfPath, type, anthropic);

        // Infoga exam-rad
        const examId = insertExam(
          db,
          exam,
          type,
          part,
          sourceUrl,
          exam.urls.facit ?? null,
          exam.urls.elf ?? null,
        );

        // Infoga frågor
        for (const question of questions) {
          const correctAnswer = answerMap.get(question.questionNumber) ?? null;
          insertQuestion(db, examId, question, correctAnswer);

          // Uppdatera sektionsstatistik
          if (question.section in sectionCounts) {
            sectionCounts[question.section]++;
          }
          totalQuestions++;
        }

        console.log(`[DB] ${exam.term} ${type}${part}: ${questions.length} frågor infogade`);
        totalExams++;
      } catch (err) {
        console.error(`[DB] Fel vid bearbetning av ${exam.term} ${type}${part}: ${String(err)}`);
        // Fortsätt med nästa — ett prov ska inte stoppa hela körningen
      }
    }
  }

  // Skriv ut slutrapport
  const sectionSummary = Object.entries(sectionCounts)
    .map(([section, count]) => `${section}: ${count}`)
    .join(', ');

  console.log('\n=== Scraping-sammanfattning ===');
  console.log(`Terminer: ${exams.length}`);
  console.log(`Totalt prov (inkl. varianter): ${totalExams}`);
  console.log(`Frågor per sektion: ${sectionSummary}`);
  console.log(`Totalt: ${totalQuestions} frågor`);
  console.log(`Prov utan facit: ${examsWithoutFacit}`);
}
