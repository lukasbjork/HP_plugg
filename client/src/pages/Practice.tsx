// Övningsläge – välj sektioner och antal frågor, svara en i taget
import { useState, useCallback } from 'react';
import { fetchQuestions, saveQuestion, unsaveQuestion } from '../lib/api';
import { QuestionCard } from '../components/QuestionCard';
import { ProgressBar } from '../components/ProgressBar';
import { ALL_SECTIONS } from '../lib/sectionColors';
import type { Question, Section } from '../lib/types';

type State = 'config' | 'playing' | 'done';

const COUNT_OPTIONS = [10, 20, 40, 100];

export function Practice() {
  const [state, setState] = useState<State>('config');
  const [selectedSections, setSelectedSections] = useState<Section[]>([]);
  const [count, setCount] = useState(20);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const toggleSection = (s: Section) => {
    setSelectedSections(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const startPractice = async () => {
    setLoading(true);
    try {
      const filter = {
        section: selectedSections.length > 0 ? selectedSections.join(',') : undefined,
        limit: count,
        random: true,
      };
      const { questions: qs } = await fetchQuestions(filter);
      setQuestions(qs);
      setCurrent(0);
      setCorrectCount(0);
      setState('playing');
    } catch {
      alert('Kunde inte ladda frågor. Kontrollera att servern körs och att databasen är fylld.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswered = useCallback((isCorrect: boolean) => {
    if (isCorrect) setCorrectCount(c => c + 1);
    setTimeout(() => {
      setCurrent(c => {
        const next = c + 1;
        if (next >= questions.length) setState('done');
        return next;
      });
    }, 1200);
  }, [questions.length]);

  const toggleSave = async (q: Question) => {
    if (savedIds.has(q.id)) {
      await unsaveQuestion(q.id);
      setSavedIds(prev => { const s = new Set(prev); s.delete(q.id); return s; });
    } else {
      await saveQuestion(q.id);
      setSavedIds(prev => new Set(prev).add(q.id));
    }
  };

  // ── Konfigurations-vy ──────────────────────────────────────────────────────
  if (state === 'config') {
    return (
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-ki-text">Övningsläge</h1>
          <p className="text-ki-gray-dark mt-1">Välj sektioner och antal frågor att öva på.</p>
        </div>

        {/* Sektionsval */}
        <div className="card">
          <h2 className="font-semibold text-ki-text mb-3">Sektioner</h2>
          <div className="flex flex-wrap gap-2">
            {ALL_SECTIONS.map(s => (
              <button
                key={s}
                onClick={() => toggleSection(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  selectedSections.includes(s)
                    ? 'border-ki-blue bg-ki-blue-pale text-ki-blue'
                    : 'border-ki-gray-mid text-ki-gray-dark hover:border-ki-blue'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {selectedSections.length === 0 && (
            <p className="text-xs text-ki-gray-dark mt-2">Alla sektioner (ingen filtrering)</p>
          )}
        </div>

        {/* Antal frågor */}
        <div className="card">
          <h2 className="font-semibold text-ki-text mb-3">Antal frågor</h2>
          <div className="grid grid-cols-4 gap-2">
            {COUNT_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                  count === n
                    ? 'border-ki-blue bg-ki-blue-pale text-ki-blue'
                    : 'border-ki-gray-mid text-ki-gray-dark hover:border-ki-blue'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button onClick={startPractice} disabled={loading} className="btn-primary w-full py-3 text-base">
          {loading ? 'Laddar...' : `Starta övning (${count} frågor)`}
        </button>
      </div>
    );
  }

  // ── Övningsvy ──────────────────────────────────────────────────────────────
  if (state === 'playing' && current < questions.length) {
    const q = questions[current];
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
        {/* Framsteg */}
        <div className="flex items-center justify-between">
          <button onClick={() => setState('config')} className="text-sm text-ki-gray-dark hover:text-ki-blue transition-colors">
            ← Avbryt
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-green-600 font-medium">{correctCount} rätt</span>
            <span className="text-sm text-ki-gray-dark">/ {current} besvarade</span>
          </div>
        </div>
        <ProgressBar value={(current / questions.length) * 100} height="thin" showPercent={false} />

        {/* Fråga */}
        <div className="relative">
          <QuestionCard
            key={q.id}
            question={q}
            mode="practice"
            onAnswered={handleAnswered}
            showImmediate
            questionIndex={current}
            totalQuestions={questions.length}
          />
          {/* Spara-knapp */}
          <button
            onClick={() => toggleSave(q)}
            className="absolute top-4 right-4 text-xl hover:scale-110 transition-transform"
            title={savedIds.has(q.id) ? 'Ta bort sparad' : 'Spara fråga'}
          >
            {savedIds.has(q.id) ? '★' : '☆'}
          </button>
        </div>
      </div>
    );
  }

  // ── Resultatvy ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto text-center space-y-6 animate-slide-up">
      <div className="card">
        <div className="text-5xl mb-4">{correctCount / questions.length >= 0.8 ? '🎉' : correctCount / questions.length >= 0.6 ? '👍' : '💪'}</div>
        <h2 className="text-2xl font-bold text-ki-text">Övning klar!</h2>
        <p className="text-ki-gray-dark mt-1">
          {correctCount} av {questions.length} rätt
        </p>
        <div className="mt-4">
          <ProgressBar
            value={(correctCount / questions.length) * 100}
            color={correctCount / questions.length >= 0.7 ? 'bg-green-500' : 'bg-amber-500'}
            height="thick"
          />
        </div>
        <p className="text-xl font-bold text-ki-blue mt-3">
          {Math.round((correctCount / questions.length) * 100)}%
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={() => setState('config')} className="btn-secondary flex-1">
          Ny övning
        </button>
        <button onClick={startPractice} className="btn-primary flex-1">
          Öva igen
        </button>
      </div>
    </div>
  );
}
