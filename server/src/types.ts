// Typdefinitioner för Högskoleprovets backend-API

export interface Exam {
  id: number;
  term: string;        // t.ex. "VT2023"
  year: number;
  season: string;      // "VT" eller "HT"
  type: string;        // t.ex. "HP"
  part: string | null;
  variant: string | null;
  source_url: string | null;
  facit_url: string | null;
  elf_url: string | null;
}

export interface Question {
  id: number;
  exam_id: number;
  question_number: number;
  section: string;     // t.ex. "ORD", "LÄS", "MEK", "XYZ", "KVA", "NOG", "DTK"
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
  correct_answer: string | null;
  difficulty: number | null;
  page_ref: string | null;
}

export interface UserAnswer {
  id: number;
  question_id: number;
  selected_answer: string;
  is_correct: number;   // 0 eller 1 (SQLite har ingen boolean)
  time_spent_seconds: number | null;
  answered_at: string;  // ISO-datumsträng
  mode: string | null;  // t.ex. "övning", "prov"
}

export interface SavedQuestion {
  id: number;
  question_id: number;
  note: string | null;
  saved_at: string;  // ISO-datumsträng
}

export interface SectionStats {
  answered: number;
  correct: number;
  accuracy: number;
  totalQuestions: number;
}

export interface AnswerBody {
  selectedAnswer: string;
  timeSpentSeconds: number;
  mode: string;
}

export interface SaveBody {
  note?: string;
}

export interface StudyPlanBody {
  stats: Record<string, SectionStats>;
  targetDate: string;
}

export interface WordBody {
  word: string;
  context?: string;
}
