/**
 * Extraherar frågor från prov-PDF:er via pdfjs-dist.
 * Använder Claude Vision som fallback för sidor med komplex layout (t.ex. DTK-diagram).
 */

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import Anthropic from '@anthropic-ai/sdk';
import { fromPath } from 'pdf2pic';
import * as fs from 'fs';
import * as path from 'path';
import type { ParsedQuestion } from './types.js';

// Inaktivera web worker — kör i Node.js
(pdfjsLib as unknown as { GlobalWorkerOptions: { workerSrc: string } })
  .GlobalWorkerOptions.workerSrc = '';

// ---------------------------------------------------------------------------
// Sektionsnamn som känns igen i texten
// ---------------------------------------------------------------------------

/** Alla kända sektionsbeteckningar */
const KNOWN_SECTIONS = new Set(['ORD', 'LÄS', 'MEK', 'XYZ', 'KVA', 'NOG', 'DTK']);

type SectionName = 'ORD' | 'LÄS' | 'MEK' | 'XYZ' | 'KVA' | 'NOG' | 'DTK';

/** Regex för en sektionsrubrik som står ensam på en rad */
const SECTION_RE = /^\s*(ORD|LÄS|MEK|XYZ|KVA|NOG|DTK)\s*$/;

/** Regex för ett frågenummer i början av en rad */
const QUESTION_NUMBER_RE = /^\s*(\d{1,2})\s*[.)]\s*/;

/** Regex för ett svarsalternativ i början av en rad */
const OPTION_RE = /^\s*([A-E])\s*[.)]\s*(.*)/;

// ---------------------------------------------------------------------------
// Textextraktion med pdfjs-dist
// ---------------------------------------------------------------------------

/** En sida i PDF:en representerad som rader */
interface PdfPage {
  pageNum: number;
  lines: string[];
}

/**
 * Extraherar text sida för sida ur en PDF-fil.
 */
async function extractPages(pdfPath: string): Promise<PdfPage[]> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));

  const pdf = await (pdfjsLib as unknown as {
    getDocument: (src: { data: Uint8Array }) => { promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str: string; hasEOL?: boolean }> }>;
      }>;
    }> };
  }).getDocument({ data }).promise;

  const pages: PdfPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Bygg rader: pdfjs ger textfragment, inte rader
    const rawText = content.items
      .map((item) => (item.hasEOL ? item.str + '\n' : item.str))
      .join('');

    const lines = rawText.split('\n').map((l) => l.trimEnd());
    pages.push({ pageNum: i, lines });
  }

  return pages;
}

// ---------------------------------------------------------------------------
// Tolkningsstatemachine
// ---------------------------------------------------------------------------

interface QuestionAccumulator {
  questionNumber: number;
  section: SectionName;
  textLines: string[];
  options: Partial<Record<'A' | 'B' | 'C' | 'D' | 'E', string>>;
  pageRef: number;
}

/**
 * Bygger ParsedQuestion från en ackumulator när frågan är klar.
 */
function finalizeQuestion(acc: QuestionAccumulator): ParsedQuestion {
  return {
    questionNumber: acc.questionNumber,
    section: acc.section,
    questionText: acc.textLines.join(' ').trim(),
    optionA: acc.options['A'],
    optionB: acc.options['B'],
    optionC: acc.options['C'],
    optionD: acc.options['D'],
    optionE: acc.options['E'],
    pageRef: acc.pageRef,
  };
}

/**
 * Parsar alla sidor och returnerar en lista av tolkade frågor.
 * Hanterar sektionsväxlingar och svarsalternativ.
 */
function parsePages(pages: PdfPage[]): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  let currentSection: SectionName | null = null;
  let current: QuestionAccumulator | null = null;

  const pushCurrent = (): void => {
    if (current && current.textLines.length > 0) {
      questions.push(finalizeQuestion(current));
      current = null;
    }
  };

  for (const { pageNum, lines } of pages) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Kontrollera om raden är en sektionsrubrik
      const sectionMatch = trimmed.match(SECTION_RE);
      if (sectionMatch && KNOWN_SECTIONS.has(sectionMatch[1])) {
        pushCurrent();
        currentSection = sectionMatch[1] as SectionName;
        continue;
      }

      // Kontrollera om raden börjar ett nytt frågenummer
      const qMatch = trimmed.match(QUESTION_NUMBER_RE);
      if (qMatch && currentSection) {
        pushCurrent();
        const num = parseInt(qMatch[1], 10);
        const restOfLine = trimmed.slice(qMatch[0].length).trim();
        current = {
          questionNumber: num,
          section: currentSection,
          textLines: restOfLine ? [restOfLine] : [],
          options: {},
          pageRef,
        };
        var pageRef = pageNum; // eslint-disable-line no-var
        if (current) current.pageRef = pageNum;
        continue;
      }

      // Kontrollera om raden är ett svarsalternativ
      const optMatch = trimmed.match(OPTION_RE);
      if (optMatch && current) {
        const letter = optMatch[1] as 'A' | 'B' | 'C' | 'D' | 'E';
        current.options[letter] = optMatch[2].trim();
        continue;
      }

      // Annars: fortsättning av frågans text
      if (current) {
        current.textLines.push(trimmed);
      }
    }
  }

  // Spara den sista frågan
  pushCurrent();

  return questions;
}

// ---------------------------------------------------------------------------
// Claude Vision-fallback
// ---------------------------------------------------------------------------

/** SystemPrompt för Claude Vision */
const VISION_SYSTEM_PROMPT = `Du är expert på att extrahera provfrågor från svenska högskoleprov (Högskoleprovet).
Returnera alltid ett JSON-objekt med exakt detta schema utan ytterligare text:
{ "questions": [{ "questionNumber": 1, "section": "ORD", "questionText": "...", "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...", "optionE": "..." }] }`;

/** Användarinstruktion som skickas med varje bild */
const VISION_USER_PROMPT = `Extrahera alla frågor från denna provsida för Högskoleprovet (Sverige).
Returnera ett JSON-objekt: { "questions": [{ "questionNumber": 1, "section": "ORD", "questionText": "...", "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...", "optionE": "..." }] }
Sections är: ORD, LÄS, MEK (verbal) eller XYZ, KVA, NOG, DTK (kvantitativ).
Om sidan innehåller diagram för DTK: skriv questionText som "DTK-diagram, se sida X" och lägg till pageRef.`;

/**
 * Konverterar en PDF-sida till PNG och skickar den till Claude Vision
 * för frågeextraktion.
 *
 * @param pdfPath  - Sökväg till PDF:en
 * @param pageNum  - Sidnummer (1-baserat)
 * @param anthropic - Anthropic-klientinstans
 */
export async function extractWithClaudeVision(
  pdfPath: string,
  pageNum: number,
  anthropic: Anthropic,
): Promise<ParsedQuestion[]> {
  console.log(`[PDF] Claude Vision-fallback för sida ${pageNum} i ${path.basename(pdfPath)}`);

  // Temporärkatalog för PNG-filer
  const tmpDir = path.join(path.dirname(pdfPath), '.vision-tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  // Konvertera PDF-sida till PNG
  const converter = fromPath(pdfPath, {
    density: 150,           // 150 DPI är tillräckligt för Claude Vision
    saveFilename: `page_${pageNum}`,
    savePath: tmpDir,
    format: 'png',
    width: 1240,
    height: 1754,
  });

  const result = await converter(pageNum);
  const imagePath = result.path;

  if (!imagePath || !fs.existsSync(imagePath)) {
    console.warn(`[PDF] Kunde inte konvertera sida ${pageNum} till bild`);
    return [];
  }

  // Läs bildfilen och koda till base64
  const imageData = fs.readFileSync(imagePath);
  const base64Image = imageData.toString('base64');

  // Skicka till Claude Vision med prompt-caching på system-prompten
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: VISION_SYSTEM_PROMPT,
        // Prompt-caching för att återanvända system-prompten
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: VISION_USER_PROMPT,
          },
        ],
      },
    ],
  });

  // Rensa temporär PNG-fil
  try {
    fs.unlinkSync(imagePath);
  } catch {
    // Ignorera rensningsfel
  }

  // Parsa JSON-svaret
  const responseText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('');

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Inget JSON i svaret');

    const parsed = JSON.parse(jsonMatch[0]) as {
      questions: Array<{
        questionNumber: number;
        section: string;
        questionText: string;
        optionA?: string;
        optionB?: string;
        optionC?: string;
        optionD?: string;
        optionE?: string;
        pageRef?: number;
      }>;
    };

    return parsed.questions.map((q) => ({
      questionNumber: q.questionNumber,
      section: (KNOWN_SECTIONS.has(q.section) ? q.section : 'XYZ') as SectionName,
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      optionE: q.optionE,
      pageRef: q.pageRef ?? pageNum,
    }));
  } catch (err) {
    console.warn(`[PDF] Kunde inte parsa Claude Vision-svar för sida ${pageNum}:`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Publik API
// ---------------------------------------------------------------------------

/**
 * Extraherar frågor ur ett prov-PDF.
 * Använder textextraktion i första hand och Claude Vision som fallback
 * för sidor med för få tolkade frågor.
 *
 * @param pdfPath    - Sökväg till prov-PDF:en
 * @param examType   - 'kvant' eller 'verb'
 * @param anthropic  - Valfri Anthropic-klient för Vision-fallback
 */
export async function extractFromPdf(
  pdfPath: string,
  examType: 'kvant' | 'verb',
  anthropic?: Anthropic,
): Promise<ParsedQuestion[]> {
  console.log(`[PDF] Extraherar frågor från ${path.basename(pdfPath)} (${examType})`);

  const pages = await extractPages(pdfPath);
  const questions = parsePages(pages);

  console.log(`[PDF] Textextraktion gav ${questions.length} frågor`);

  // Om texttolkningen gav för få frågor och Claude Vision finns tillgänglig,
  // kör Vision-fallback på varje sida
  if (questions.length < 5 && anthropic) {
    console.log(`[PDF] Kör Claude Vision-fallback (för få frågor via text)`);
    const visionQuestions: ParsedQuestion[] = [];

    for (const page of pages) {
      const pageQuestions = await extractWithClaudeVision(pdfPath, page.pageNum, anthropic);
      visionQuestions.push(...pageQuestions);
    }

    if (visionQuestions.length > questions.length) {
      console.log(`[PDF] Vision gav ${visionQuestions.length} frågor — använder Vision-resultat`);
      return visionQuestions;
    }
  }

  return questions;
}

/**
 * Extraherar frågor från ett prov-PDF. Alias som exponerar ett enhetligt
 * gränssnitt för seedDatabase.
 */
export async function extractQuestionsFromExam(
  pdfPath: string,
  examType: 'kvant' | 'verb',
  anthropic?: Anthropic,
): Promise<ParsedQuestion[]> {
  return extractFromPdf(pdfPath, examType, anthropic);
}
