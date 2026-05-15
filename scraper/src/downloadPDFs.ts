/**
 * Laddar ner PDF-filer för alla provtillfällen till lokal disk.
 * Stödjer retry med exponentiell backoff och hoppar över redan hämtade filer.
 */

import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import type { ExamEntry } from './types.js';

/** Väntar ett givet antal millisekunder. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Laddar ner en enskild URL till en lokal fil.
 * Försöker upp till maxRetries gånger med exponentiell backoff.
 *
 * @param url       - Källadressen
 * @param destPath  - Lokal målsökväg
 * @param maxRetries - Antal försök (standard 3)
 * @returns true om nedladdning lyckades, annars false
 */
async function downloadFile(url: string, destPath: string, maxRetries = 3): Promise<boolean> {
  // Skapa målmappen om den inte finns
  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  let attempt = 0;
  const delays = [2000, 4000, 8000]; // Backoff: 2s, 4s, 8s

  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HogskoleProv-Scraper/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Strömma svaret direkt till fil
      const buffer = await response.buffer();
      fs.writeFileSync(destPath, buffer);
      return true;
    } catch (err) {
      attempt++;
      if (attempt < maxRetries) {
        const delay = delays[attempt - 1] ?? 8000;
        console.log(`[DL]   Försök ${attempt}/${maxRetries} misslyckades för ${url} — väntar ${delay}ms`);
        await sleep(delay);
      }
    }
  }

  return false;
}

/**
 * Laddar ner alla PDF-filer för en lista av provtillfällen.
 *
 * Varje fil sparas som:
 *   ${downloadDir}/${term}/${filename}.pdf
 * t.ex. .tmp/VT2023/kvant1.pdf
 *
 * @param exams       - Lista av provtillfällen
 * @param downloadDir - Rotkatalog för nedladdningar
 * @returns En Map från URL-sträng till lokal filsökväg
 */
export async function downloadPDFs(
  exams: ExamEntry[],
  downloadDir: string,
): Promise<Map<string, string>> {
  const pathMap = new Map<string, string>();

  for (const exam of exams) {
    const termDir = path.join(downloadDir, exam.term);

    // Iterera alla URL:er för detta provtillfälle
    const urlEntries = Object.entries(exam.urls) as Array<[keyof ExamEntry['urls'], string | undefined]>;

    for (const [pdfType, url] of urlEntries) {
      if (!url) continue;

      const filename = `${pdfType}.pdf`;
      const destPath = path.join(termDir, filename);

      // Hoppa över redan nedladdade filer
      if (fs.existsSync(destPath)) {
        console.log(`[DL] ↷ ${exam.term}-${pdfType}.pdf (redan nedladdad)`);
        pathMap.set(url, destPath);
        continue;
      }

      // Slumpmässig fördröjning mellan requests för att vara snäll mot servern
      await sleep(1000 + Math.random() * 1000);

      const success = await downloadFile(url, destPath);

      if (success) {
        console.log(`[DL] ✓ ${exam.term}-${pdfType}.pdf`);
        pathMap.set(url, destPath);
      } else {
        console.log(`[DL] ✗ Misslyckades: ${exam.term}-${pdfType}.pdf (${url})`);
      }
    }
  }

  const totalDownloaded = pathMap.size;
  console.log(`[DL] Klart — ${totalDownloaded} filer sparade i ${downloadDir}`);

  return pathMap;
}
