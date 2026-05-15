// Delade TypeScript-typer för frontend

export interface Exam {
  id: number;
  term: string;
  year: number;
  season: 'VT' | 'HT';
  type: 'kvant' | 'verb';
  part: number;
  variant: string | null;
  source_url: string | null;
  facit_url: string | null;
  elf_url: string | null;
}

export interface Question {
  id: number;
  exam_id: number;
  question_number: number;
  section: Section;
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
  correct_answer: string | null;
  difficulty: number | null;
  page_ref: number | null;
}

export type Section = 'ORD' | 'LÄS' | 'MEK' | 'XYZ' | 'KVA' | 'NOG' | 'DTK';

export interface SectionStats {
  answered: number;
  correct: number;
  accuracy: number;
  totalQuestions: number;
}

export interface StatsResponse {
  totalAnswered: number;
  totalCorrect: number;
  accuracy: number;
  perSection: Record<Section, SectionStats>;
  estimatedHpScore: number;
  streak: number;
}

export interface HistoryEntry {
  date: string;
  count: number;
}

export interface SectionHistoryEntry {
  date: string;
  section: string;
  answered: number;
  correct: number;
  accuracy: number;
}

export type PracticeMode = 'practice' | 'simulation' | 'flashcard';
