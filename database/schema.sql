-- Högskoleprovets databas-schema
-- Skapad automatiskt om tabellerna saknas

CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL,          -- t.ex. "VT2023"
  year INTEGER NOT NULL,
  season TEXT NOT NULL,        -- "VT" eller "HT"
  type TEXT NOT NULL,          -- "kvant" eller "verb"
  part INTEGER NOT NULL,       -- 1 eller 2
  variant TEXT,                -- t.ex. "(3)", NULL om ingen variant
  source_url TEXT,
  facit_url TEXT,
  elf_url TEXT
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  section TEXT NOT NULL,       -- "ORD", "LÄS", "MEK", "XYZ", "KVA", "NOG", "DTK"
  question_text TEXT NOT NULL,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  option_e TEXT,
  correct_answer TEXT,         -- "A", "B", "C", "D" eller "E", NULL om facit saknas
  difficulty INTEGER DEFAULT NULL,  -- 1–5, beräknas från användardata
  page_ref INTEGER             -- PDF-sidnummer (viktigt för DTK med diagram)
);

CREATE TABLE IF NOT EXISTS user_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_answer TEXT NOT NULL,
  is_correct INTEGER NOT NULL, -- 0 eller 1
  time_spent_seconds INTEGER,
  answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  mode TEXT NOT NULL           -- "practice", "simulation", "flashcard"
);

CREATE TABLE IF NOT EXISTS saved_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  note TEXT,
  saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index för snabba sökningar
CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_questions_section ON questions(section);
CREATE INDEX IF NOT EXISTS idx_user_answers_question ON user_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_date ON user_answers(answered_at);
CREATE INDEX IF NOT EXISTS idx_exams_term ON exams(term);
