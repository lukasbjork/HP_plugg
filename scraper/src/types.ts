/**
 * Typdefinitioner för högskoleprovet-scrapern.
 * Används av alla moduler i scraper/src/.
 */

/** Ett provtillfälle med metadata och URL:er till dess PDF-filer. */
export interface ExamEntry {
  /** Kort beteckning, t.ex. "VT2023" eller "HT2016(3)" */
  term: string;
  /** Provåret, t.ex. 2023 */
  year: number;
  /** Vår eller höst */
  season: 'VT' | 'HT';
  /** Variant om provet gavs i flera versioner, t.ex. "(3)", annars null */
  variant: string | null;
  /** Mappnamn i URL:en, t.ex. "var-2023" eller "var-2016-3" */
  folderName: string;
  /** Alla kända PDF-URL:er för detta provtillfälle */
  urls: {
    kvant1?: string;
    kvant2?: string;
    verb1?: string;
    verb2?: string;
    facit?: string;
    elf?: string;
  };
}

/** En tolkad fråga från ett prov-PDF. */
export interface ParsedQuestion {
  /** Frågans löpnummer inom sin del */
  questionNumber: number;
  /** Provdelen/sektionen frågan tillhör */
  section: 'ORD' | 'LÄS' | 'MEK' | 'XYZ' | 'KVA' | 'NOG' | 'DTK';
  /** Frågans brödtext */
  questionText: string;
  /** Svarsalternativ */
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  optionE?: string;
  /** Sidnummer i originalet (används för DTK-diagram) */
  pageRef?: number;
}

/** Ett svar från facit-PDF:en. */
export interface FacitAnswer {
  /** Frågans löpnummer */
  questionNumber: number;
  /** Rätt svar */
  answer: 'A' | 'B' | 'C' | 'D' | 'E';
}
