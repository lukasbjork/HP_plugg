// Provsimuleringsläge – fullständigt prov under tidspress
import { useState, useEffect, useCallback } from 'react';
import { fetchExams, fetchQuestions } from '../lib/api';
import { submitAnswer } from '../lib/api';
import { Timer } from '../components/Timer';
import { SectionBadge } from '../components/SectionBadge';
import { ProgressBar } from '../components/ProgressBar';
import type { Question } from '../lib/types';
import { KI_TARGET_SCORE } from '../lib/sectionColors';

// Officiell tid per delprov: 55 minuter
const SECTION_TIME_SECONDS = 55 * 60;

type State = 'config' | 'playing' | 'done';

interface SimResult {
  question: Question;
  selected: string | null;
  isCorrect: boolean;
}

export function Simulation() {
  const [state, setState] = useState<State>('config');
  const [exams, setExams] = useState<{ id: number; label: string }[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState<SimResult[]>([]);
  const [answers, setAnswers] = useState<Map<number, string>>(new Map());
  const [timeLeft, setTimeLeft] = useState(SECTION_TIME_SECONDS);
  const [timerActive, setTimerActive] = useState(false);
  const [loading, setLoading] = useState(false);

  // Ladda alla prov vid mount
  useEffect(() => {
    fetchExams().then(({ exams: e }) => {
      // Deduplica på term och välj bara ett prov per term
      const seen = new Set<string>();
      const opts = e
        .filter(ex => {
          if (seen.has(ex.term)) return false;
          seen.add(ex.term);
          return true;
        })
        .map(ex => ({ id: ex.id, label: `${ex.term}${ex.variant ? ' ' + ex.variant : ''}` }));
      setExams(opts);
      if (opts.length > 0) setSelectedExamId(opts[0].id);
    }).catch(() => {});
  }, []);

  // Nedräkningstimer
  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(interval);
          setTimerActive(false);
          // Tid ute – avsluta automatiskt
          finishSimulation();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const startSimulation = async (useRandom: boolean) => {
    setLoading(true);
    try {
      let qs: Question[];
      if (useRandom || !selectedExamId) {
        const { questions: q } = await fetchQuestions({ limit: 80, random: true });
        qs = q;
      } else {
        const { questions: q } = await fetchQuestions({ limit: 80, random: false });
        qs = q;
      }
      setQuestions(qs);
      setCurrent(0);
      setAnswers(new Map());
      setResults([]);
      setTimeLeft(SECTION_TIME_SECONDS);
      setTimerActive(true);
      setState('playing');
    } catch {
      alert('Kunde inte ladda frågor.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (key: string) => {
    setAnswers(prev => new Map(prev).set(questions[current].id, key));
  };

  const goNext = () => {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
    } else {
      finishSimulation();
    }
  };

  const goPrev = () => {
    if (current > 0) setCurrent(c => c - 1);
  };

  const finishSimulation = useCallback(async () => {
    setTimerActive(false);

    // Spara alla svar
    const simResults: SimResult[] = [];
    for (const q of questions) {
      const selected = answers.get(q.id) ?? null;
      let isCorrect = false;
      if (selected) {
        const res = await submitAnswer(q.id, selected, 0, 'simulation');
        isCorrect = res.isCorrect;
      }
      simResults.push({ question: q, selected, isCorrect });
    }

    setResults(simResults);
    setState('done');
  }, [questions, answers]);

  // ── Konfig-vy ──────────────────────────────────────────────────────────────
  if (state === 'config') {
    return (
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-ki-text">Provsimulering</h1>
          <p className="text-ki-gray-dark mt-1">Öva under riktiga provförhållanden – 55 minuter per delprov.</p>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold">Välj prov</h2>
          <select
            value={selectedExamId ?? ''}
            onChange={e => setSelectedExamId(Number(e.target.value))}
            className="w-full border border-ki-gray-mid rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ki-blue"
          >
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => startSimulation(false)}
            disabled={loading || !selectedExamId}
            className="btn-primary flex-1 py-3"
          >
            Starta valt prov
          </button>
          <button
            onClick={() => startSimulation(true)}
            disabled={loading}
            className="btn-secondary flex-1 py-3"
          >
            Slumpmässigt prov
          </button>
        </div>

        <div className="card bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-800">
            <strong>OBS:</strong> Ingen feedback ges under provet. Precis som på riktigt.
            Tid: {SECTION_TIME_SECONDS / 60} min. Alla svar sparas i din statistik.
          </p>
        </div>
      </div>
    );
  }

  // ── Provsimulerings-vy ─────────────────────────────────────────────────────
  if (state === 'playing' && questions.length > 0) {
    const q = questions[current];
    const selectedKey = answers.get(q.id);
    const options: Array<{ key: string; text: string | null }> = [
      { key: 'A', text: q.option_a },
      { key: 'B', text: q.option_b },
      { key: 'C', text: q.option_c },
      { key: 'D', text: q.option_d },
      { key: 'E', text: q.option_e },
    ].filter(o => o.text !== null);

    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
        {/* Header med timer */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-ki-gray-dark">
            {current + 1} / {questions.length}
          </div>
          <Timer secondsLeft={timeLeft} totalSeconds={SECTION_TIME_SECONDS} />
          <button
            onClick={finishSimulation}
            className="text-sm text-red-500 hover:text-red-700 transition-colors"
          >
            Lämna in
          </button>
        </div>

        <ProgressBar value={(current / questions.length) * 100} height="thin" showPercent={false} />

        {/* Fråga */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <SectionBadge section={q.section} />
            <span className="text-sm text-ki-gray-dark">Fråga {q.question_number}</span>
          </div>
          <p className="text-base text-ki-text leading-relaxed mb-5 whitespace-pre-wrap">{q.question_text}</p>

          <div className="space-y-2">
            {options.map(({ key, text }) => (
              <button
                key={key}
                onClick={() => handleAnswer(key)}
                className={`w-full text-left answer-option ${selectedKey === key ? 'selected' : ''}`}
              >
                <span className="font-mono font-bold text-ki-blue min-w-[1.5rem]">{key}</span>
                <span>{text}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between gap-3">
          <button onClick={goPrev} disabled={current === 0} className="btn-secondary">
            ← Föregående
          </button>
          {current < questions.length - 1 ? (
            <button onClick={goNext} className="btn-primary">
              Nästa →
            </button>
          ) : (
            <button onClick={finishSimulation} className="btn-gold">
              Lämna in prov
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Resultat-vy ────────────────────────────────────────────────────────────
  const totalCorrect = results.filter(r => r.isCorrect).length;
  const accuracy = results.length > 0 ? totalCorrect / results.length : 0;
  const hpScore = accuracy * KI_TARGET_SCORE;

  // Räkna per sektion
  const sectionResults: Record<string, { correct: number; total: number }> = {};
  for (const r of results) {
    const s = r.question.section;
    if (!sectionResults[s]) sectionResults[s] = { correct: 0, total: 0 };
    sectionResults[s].total++;
    if (r.isCorrect) sectionResults[s].correct++;
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-slide-up">
      <div className="card text-center">
        <div className="text-4xl mb-3">{accuracy >= 0.8 ? '🏆' : accuracy >= 0.6 ? '📈' : '💪'}</div>
        <h2 className="text-2xl font-bold text-ki-text">Provresultat</h2>
        <div className="text-4xl font-bold text-ki-blue mt-2 font-mono">{hpScore.toFixed(2)}</div>
        <div className="text-ki-gray-dark text-sm">HP-poäng (uppskattad)</div>
        <div className={`mt-2 text-sm font-medium ${hpScore >= KI_TARGET_SCORE ? 'text-green-600' : 'text-amber-600'}`}>
          {hpScore >= KI_TARGET_SCORE
            ? '✓ Når KI:s antagningsgräns!'
            : `${(KI_TARGET_SCORE - hpScore).toFixed(2)} poäng kvar till KI (≥2.0)`}
        </div>
      </div>

      {/* Per sektion */}
      <div className="card">
        <h3 className="font-semibold mb-3">Resultat per sektion</h3>
        <div className="space-y-2">
          {Object.entries(sectionResults).map(([section, { correct, total }]) => (
            <div key={section} className="flex items-center gap-3">
              <SectionBadge section={section} size="sm" />
              <ProgressBar
                value={(correct / total) * 100}
                height="normal"
                showPercent={false}
                color={correct / total >= 0.7 ? 'bg-green-500' : 'bg-amber-500'}
              />
              <span className="text-sm text-ki-gray-dark w-16 text-right">
                {correct}/{total}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={() => setState('config')} className="btn-primary w-full py-3">
        Nytt prov
      </button>
    </div>
  );
}
