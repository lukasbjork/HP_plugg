// Frågobibliotek – sökbar, filterbar lista
import { useState, useEffect } from 'react';
import { fetchQuestions } from '../lib/api';
import { SectionBadge } from '../components/SectionBadge';
import { ALL_SECTIONS } from '../lib/sectionColors';
import type { Question, Section } from '../lib/types';

const PAGE_SIZE = 30;

export function Library() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);

  // Filter-state
  const [section, setSection] = useState('');
  const [unanswered, setUnanswered] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = async (newOffset = 0) => {
    setLoading(true);
    try {
      const { questions: qs, total: t } = await fetchQuestions({
        section: section || undefined,
        unanswered: unanswered || undefined,
        saved: saved || undefined,
        limit: PAGE_SIZE,
        offset: newOffset,
      });
      setQuestions(qs);
      setTotal(t);
      setOffset(newOffset);
    } catch {
      // Ignorera — kan bero på tom databas
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(0); }, [section, unanswered, saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ki-text">Frågobibliotek</h1>
        <p className="text-ki-gray-dark mt-1">{total.toLocaleString('sv-SE')} frågor tillgängliga</p>
      </div>

      {/* Filter */}
      <div className="card space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSection('')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
              !section ? 'border-ki-blue bg-ki-blue-pale text-ki-blue' : 'border-ki-gray-mid text-ki-gray-dark'
            }`}
          >
            Alla
          </button>
          {ALL_SECTIONS.map(s => (
            <button
              key={s}
              onClick={() => setSection(section === s ? '' : s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                section === s ? 'border-ki-blue bg-ki-blue-pale text-ki-blue' : 'border-ki-gray-mid text-ki-gray-dark'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={unanswered}
              onChange={e => setUnanswered(e.target.checked)}
              className="w-4 h-4 accent-ki-blue"
            />
            <span className="text-ki-gray-dark">Ej besvarade</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={saved}
              onChange={e => setSaved(e.target.checked)}
              className="w-4 h-4 accent-ki-blue"
            />
            <span className="text-ki-gray-dark">Sparade</span>
          </label>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-ki-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-16 text-ki-gray-dark">
          <div className="text-4xl mb-3">📭</div>
          <p>Inga frågor hittades.</p>
          <p className="text-sm mt-1">Kör <code className="font-mono bg-gray-100 px-1 rounded">npm run scrape</code> för att fylla databasen.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map(q => (
            <div key={q.id} className="card cursor-pointer hover:shadow-md transition-all" onClick={() => setExpanded(expanded === q.id ? null : q.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <SectionBadge section={q.section as Section} size="sm" />
                  {q.correct_answer === null && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Inget facit</span>
                  )}
                  {q.difficulty !== null && (
                    <span className="text-xs text-ki-gray-dark">Sv: {q.difficulty}/5</span>
                  )}
                </div>
                <span className="text-ki-gray-dark text-sm shrink-0">#{q.question_number}</span>
              </div>

              <p className="text-sm text-ki-text mt-2 line-clamp-2">{q.question_text}</p>

              {expanded === q.id && (
                <div className="mt-3 pt-3 border-t border-ki-gray-mid space-y-1">
                  {(['A', 'B', 'C', 'D', 'E'] as const).map(key => {
                    const text = q[`option_${key.toLowerCase()}` as keyof Question] as string | null;
                    if (!text) return null;
                    return (
                      <div
                        key={key}
                        className={`flex gap-2 text-sm p-2 rounded ${q.correct_answer === key ? 'bg-green-50 text-green-800 font-medium' : 'text-ki-text'}`}
                      >
                        <span className="font-mono font-bold">{key})</span>
                        <span>{text}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button
            onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
            disabled={currentPage === 1}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            ←
          </button>
          <span className="text-sm text-ki-gray-dark">
            Sida {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => load(offset + PAGE_SIZE)}
            disabled={currentPage === totalPages}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
