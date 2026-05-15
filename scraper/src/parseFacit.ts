/**
 * Extraherar svar från facit-PDF:er med pdfjs-dist.
 * Stödjer formaten "1. A", "2) C", "1 A" etc.
 */

// Node.js-kompatibel import av pdfjs-dist (ingen web worker behövs)
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { FacitAnswer } from './types.js';

// Inaktivera web worker — kör synkront i Node.js
(pdfjsLib as unknown as { GlobalWorkerOptions: { workerSrc: string } })
  .GlobalWorkerOptions.workerSrc = '';

/**
 * Regex för att matcha en svarrad i facit-PDF:en.
 * Stödjer format som: "1. A", "2) B", "12 C", " 3.  D "
 */
const ANSWER_LINE_RE = /^\s*(\d{1,2})\s*[.):\s]\s*([ABCDE])\s*$/;

/**
 * Extraherar all text från ett PDF-dokument och returnerar den
 * sida för sida som en array av strängar.
 */
async function extractTextFromPdf(pdfPath: string): Promise<string[]> {
  const data = new Uint8Array(
    (await import('fs')).readFileSync(pdfPath),
  );

  const pdf = await (pdfjsLib as unknown as {
    getDocument: (src: { data: Uint8Array }) => { promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
      }>;
    }> };
  }).getDocument({ data }).promise;

  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join('\n');
    pages.push(text);
  }

  return pages;
}

/**
 * Parsar en svarrad och returnerar ett FacitAnswer-objekt,
 * eller null om raden inte matchar det förväntade formatet.
 */
function parseAnswerLine(line: string): FacitAnswer | null {
  const m = line.match(ANSWER_LINE_RE);
  if (!m) return null;

  const questionNumber = parseInt(m[1], 10);
  const answer = m[2] as FacitAnswer['answer'];

  return { questionNumber, answer };
}

/**
 * Läser en facit-PDF och returnerar en array av svar sorterade
 * efter frågans löpnummer.
 *
 * @param pdfPath - Sökväg till facit-PDF:en
 * @returns Array av FacitAnswer
 */
export async function parseFacit(pdfPath: string): Promise<FacitAnswer[]> {
  console.log(`[PDF] Parsar facit: ${pdfPath}`);

  const pages = await extractTextFromPdf(pdfPath);
  const allText = pages.join('\n');
  const lines = allText.split('\n');

  const answers: FacitAnswer[] = [];
  const seen = new Set<number>();

  for (const line of lines) {
    const answer = parseAnswerLine(line);
    if (!answer) continue;

    // Undvik dubbletter (t.ex. om samma fråga dyker upp på flera sidor)
    if (seen.has(answer.questionNumber)) continue;

    seen.add(answer.questionNumber);
    answers.push(answer);
  }

  // Sortera på frågans löpnummer
  answers.sort((a, b) => a.questionNumber - b.questionNumber);

  if (answers.length < 5) {
    console.warn(
      `[PDF] Varning: Endast ${answers.length} svar hittades i facit (${pdfPath}). ` +
      'Kontrollera PDF-formatet.',
    );
  } else {
    console.log(`[PDF] Hittade ${answers.length} svar i facit`);
  }

  return answers;
}
