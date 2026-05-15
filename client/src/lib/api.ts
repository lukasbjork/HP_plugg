// API-klient för kommunikation med Express-backend
import type { Exam, Question, StatsResponse, HistoryEntry, SectionHistoryEntry } from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ── Exams ─────────────────────────────────────────────────────────────────────

export async function fetchExams(): Promise<{ exams: Exam[]; grouped: Record<string, Exam[]> }> {
  return get('/exams');
}

export async function fetchExamQuestions(
  examId: number,
  section?: string
): Promise<{ questions: Question[]; total: number }> {
  const qs = section ? `?section=${section}` : '';
  return get(`/exams/${examId}/questions${qs}`);
}

// ── Questions ─────────────────────────────────────────────────────────────────

export interface QuestionFilter {
  section?: string;
  term?: string;
  year?: number;
  difficulty?: string;
  unanswered?: boolean;
  saved?: boolean;
  limit?: number;
  offset?: number;
  random?: boolean;
}

export async function fetchQuestions(
  filter: QuestionFilter = {}
): Promise<{ questions: Question[]; total: number }> {
  const params = new URLSearchParams();
  if (filter.section) params.set('section', filter.section);
  if (filter.term) params.set('term', filter.term);
  if (filter.year) params.set('year', String(filter.year));
  if (filter.difficulty) params.set('difficulty', filter.difficulty);
  if (filter.unanswered) params.set('unanswered', 'true');
  if (filter.saved) params.set('saved', 'true');
  if (filter.limit) params.set('limit', String(filter.limit));
  if (filter.offset) params.set('offset', String(filter.offset));
  if (filter.random) params.set('random', 'true');
  const qs = params.toString() ? `?${params}` : '';
  return get(`/questions${qs}`);
}

export async function submitAnswer(
  questionId: number,
  selectedAnswer: string,
  timeSpentSeconds: number,
  mode: string
): Promise<{ isCorrect: boolean; correctAnswer: string | null }> {
  return post(`/questions/${questionId}/answer`, { selectedAnswer, timeSpentSeconds, mode });
}

export async function saveQuestion(questionId: number, note?: string): Promise<void> {
  await post(`/questions/${questionId}/save`, { note });
}

export async function unsaveQuestion(questionId: number): Promise<void> {
  await del(`/questions/${questionId}/save`);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function fetchStats(): Promise<StatsResponse> {
  return get('/stats');
}

export async function fetchWeakAreas(): Promise<{
  weakAreas: Array<{ section: string; answered: number; correct: number; accuracy: number; totalQuestions: number }>;
}> {
  return get('/stats/weak-areas');
}

export async function fetchHistory(): Promise<{ history: HistoryEntry[] }> {
  return get('/stats/history');
}

export async function fetchSectionHistory(
  section?: string,
  days = 30
): Promise<{ history: SectionHistoryEntry[] }> {
  const qs = section ? `?section=${section}&days=${days}` : `?days=${days}`;
  return get(`/stats/section-history${qs}`);
}

// ── AI (SSE-strömning) ─────────────────────────────────────────────────────────

/**
 * Streama AI-svar via fetch (SSE-format).
 * Anropar onChunk för varje textdel, onDone när klart.
 */
async function streamAI(
  path: string,
  body: unknown,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void
): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json() as { error?: string };
    onError(data.error ?? `HTTP ${res.status}`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) { onDone(); return; }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') { onDone(); return; }
      try {
        const parsed = JSON.parse(data) as { text?: string; error?: string };
        if (parsed.error) { onError(parsed.error); return; }
        if (parsed.text) onChunk(parsed.text);
      } catch {
        // Ignorera felformaterade rader
      }
    }
  }

  onDone();
}

export function explainQuestion(
  questionId: number,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void
): Promise<void> {
  return streamAI('/ai/explain', { questionId }, onChunk, onDone, onError);
}

export function generateStudyPlan(
  stats: Record<string, unknown>,
  targetDate: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void
): Promise<void> {
  return streamAI('/ai/study-plan', { stats, targetDate }, onChunk, onDone, onError);
}

export function explainWord(
  word: string,
  context: string | undefined,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void
): Promise<void> {
  return streamAI('/ai/word', { word, context }, onChunk, onDone, onError);
}
