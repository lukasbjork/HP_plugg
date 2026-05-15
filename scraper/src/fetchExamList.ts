/**
 * Hämtar listan av alla tillgängliga högskoleprov från indexsidan
 * och bygger upp ExamEntry-objekt med metadata och PDF-URL:er.
 */

import fetch from 'node-fetch';
import type { ExamEntry } from './types.js';

const INDEX_URL = 'https://www.hogskoleprovet.nu/gamla-hogskoleprov/';
const BASE_URL = 'https://www.hogskoleprovet.nu/public/uploads/hogskoleprovet/hogskoleprov/';

/** VT2021 ställdes in pga COVID — hoppas alltid över */
const CANCELLED_TERMS = new Set(['VT2021']);

/** Earliest year to include */
const MIN_YEAR = 2013;

/**
 * Extraherar ett attributvärde ur en HTML-tagg-sträng.
 * T.ex. extractAttr('<a href="foo.pdf">', 'href') => 'foo.pdf'
 */
function extractAttr(tag: string, attr: string): string | null {
  // Matchar både enkla och dubbla citationstecken
  const re = new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'i');
  const m = tag.match(re);
  return m ? m[1] : null;
}

/**
 * Tar bort alla HTML-taggar från en sträng och trimmar whitespace.
 */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Delar upp en HTML-sträng i block avgränsade av ett givet element.
 * T.ex. splitByTag('<tr>a</tr><tr>b</tr>', 'tr') => ['<tr>a</tr>', '<tr>b</tr>']
 */
function splitByTag(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
  return html.match(re) ?? [];
}

/**
 * Parsar ett folder-namn (t.ex. "var-2023" eller "var-2016-3") och
 * returnerar { year, season, variant } eller null om formatet inte matchar.
 */
function parseFolderName(folder: string): { year: number; season: 'VT' | 'HT'; variant: string | null } | null {
  // Matchar "var-YYYY" / "var-YYYY-N" eller "host-YYYY" / "host-YYYY-N"
  const m = folder.match(/^(var|host)-(\d{4})(?:-(\d+))?$/i);
  if (!m) return null;
  const season: 'VT' | 'HT' = m[1].toLowerCase() === 'var' ? 'VT' : 'HT';
  const year = parseInt(m[2], 10);
  const variant = m[3] ? `(${m[3]})` : null;
  return { year, season, variant };
}

/**
 * Extraherar alla href-attribut som slutar på .pdf ur ett HTML-block.
 */
function extractPdfHrefs(html: string): string[] {
  const re = /href\s*=\s*["']([^"']+\.pdf)["']/gi;
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    results.push(m[1]);
  }
  return results;
}

/**
 * Returnerar PDF-typen ('kvant1', 'kvant2', 'verb1', 'verb2', 'facit', 'elf')
 * baserat på filnamnet, eller null om okänt.
 */
function classifyPdf(filename: string): keyof ExamEntry['urls'] | null {
  const name = filename.toLowerCase();
  if (name.includes('kvant1') || name === 'kvant1.pdf') return 'kvant1';
  if (name.includes('kvant2') || name === 'kvant2.pdf') return 'kvant2';
  if (name.includes('verb1') || name === 'verb1.pdf') return 'verb1';
  if (name.includes('verb2') || name === 'verb2.pdf') return 'verb2';
  if (name.includes('facit') || name === 'facit.pdf') return 'facit';
  if (name.includes('elf') || name === 'elf.pdf') return 'elf';
  return null;
}

/**
 * Hämtar indexsidan och returnerar en lista av alla tillgängliga provtillfällen
 * från VT2013 och framåt (exklusive inställda prov).
 */
export async function fetchExamList(): Promise<ExamEntry[]> {
  const response = await fetch(INDEX_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; HogskoleProv-Scraper/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`[FETCH] HTTP ${response.status} från ${INDEX_URL}`);
  }

  const html = await response.text();

  // Hitta tabellen som innehåller "Kvantitativ" i headern (det nya formatet)
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  const tables = html.match(tableRe) ?? [];

  // Välj tabellen vars header nämner "Kvantitativ" eller "kvant"
  let targetTable: string | null = null;
  for (const table of tables) {
    if (/kvantitativ|kvant/i.test(table)) {
      targetTable = table;
      break;
    }
  }

  // Fallback: ta den första tabellen om ingen specifik hittades
  if (!targetTable) {
    targetTable = tables[0] ?? null;
  }

  if (!targetTable) {
    throw new Error('[FETCH] Hittade ingen tabell på indexsidan');
  }

  const rows = splitByTag(targetTable, 'tr');

  // Map: folderName -> ExamEntry (vi bygger upp successivt)
  const examMap = new Map<string, ExamEntry>();

  for (const row of rows) {
    const cells = splitByTag(row, 'td');
    if (cells.length === 0) continue;

    // Extrahera alla PDF-href:ar ur hela raden
    const pdfHrefs = extractPdfHrefs(row);
    if (pdfHrefs.length === 0) continue; // Hoppa över header- och tomma rader

    // Bestäm folder-namn från den första PDF-URL:en
    let folderName: string | null = null;
    for (const href of pdfHrefs) {
      // URL-format: .../hogskoleprov/[folderName]/[fil].pdf
      const folderMatch = href.match(/hogskoleprov\/([^/]+)\//i);
      if (folderMatch) {
        folderName = folderMatch[1];
        break;
      }
      // Alternativt: bara mappsegmentet näst sist i sökvägen
      const parts = href.split('/');
      if (parts.length >= 2) {
        const candidate = parts[parts.length - 2];
        if (/^(var|host)-\d{4}/i.test(candidate)) {
          folderName = candidate;
          break;
        }
      }
    }

    if (!folderName) continue;

    const parsed = parseFolderName(folderName);
    if (!parsed) continue;

    const { year, season, variant } = parsed;

    // Filtrera bort prov äldre än MIN_YEAR
    if (year < MIN_YEAR) continue;

    const term = `${season}${year}${variant ?? ''}`;

    // Hoppa över inställda terminer
    if (CANCELLED_TERMS.has(`${season}${year}`)) continue;

    // Hämta eller skapa ExamEntry
    if (!examMap.has(folderName)) {
      examMap.set(folderName, {
        term,
        year,
        season,
        variant,
        folderName,
        urls: {},
      });
    }

    const entry = examMap.get(folderName)!;

    // Lägg till URL:er för varje identifierad PDF
    for (const href of pdfHrefs) {
      // Bygg absolut URL om relativ
      const absoluteUrl = href.startsWith('http')
        ? href
        : href.startsWith('/')
          ? `https://www.hogskoleprovet.nu${href}`
          : `${BASE_URL}${folderName}/${href.split('/').pop()}`;

      const filename = absoluteUrl.split('/').pop() ?? '';
      const pdfType = classifyPdf(filename);
      if (pdfType) {
        entry.urls[pdfType] = absoluteUrl;
      }
    }
  }

  const exams = Array.from(examMap.values());

  // Sortera kronologiskt: äldst först, sedan VT före HT inom samma år
  exams.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.season !== b.season) return a.season === 'VT' ? -1 : 1;
    // Varianter: null (utan variant) före numrerade varianter
    const av = a.variant ?? '';
    const bv = b.variant ?? '';
    return av.localeCompare(bv);
  });

  console.log(`[FETCH] Hittade ${exams.length} provtillfällen på indexsidan`);

  return exams;
}
