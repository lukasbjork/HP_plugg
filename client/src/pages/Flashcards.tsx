// Flashcard-läge för ORD-frågor med spaced repetition och AI-förklaring
import { useState, useEffect, useCallback } from 'react';
import { fetchQuestions, submitAnswer, explainWord } from '../lib/api';
import type { Question } from '../lib/types';

type CardStatus = 'kan' | 'osäker' | 'kan_inte';

interface FlashCard {
  question: Question;
  status: CardStatus | null;
  word: string;
}

export function Flashcards() {
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [sessionStats, setSessionStats] = useState({ kan: 0, osäker: 0, kan_inte: 0 });

  useEffect(() => {
    fetchQuestions({ section: 'ORD', limit: 50, random: true })
      .then(({ questions }) => {
        // Extrahera ord från frågetexten (första "ordet" i frågan)
        const fc: FlashCard[] = questions.map(q => {
          const wordMatch = q.question_text.match(/^["«»']?([A-ZÅÄÖa-zåäö-]+)["«»']?/);
          const word = wordMatch ? wordMatch[1] : q.question_text.slice(0, 20);
          return { question: q, status: null, word };
        });
        setCards(fc);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleFlip = () => {
    setFlipped(f => !f);
    setAiText('');
    setShowAi(false);
  };

  const handleStatus = useCallback(async (status: CardStatus) => {
    if (cards.length === 0) return;

    const card = cards[current];

    // Spara svar
    if (card.question.correct_answer) {
      const ans = status === 'kan' ? card.question.correct_answer : 'X';
      await submitAnswer(card.question.id, ans, 0, 'flashcard').catch(() => {});
    }

    // Uppdatera status
    setCards(prev => prev.map((c, i) => i === current ? { ...c, status } : c));
    setSessionStats(prev => ({ ...prev, [status]: prev[status] + 1 }));

    // Nästa kort (med spaced repetition-logik: "kan_inte" hamnar sist igen)
    const nextIndex = current + 1;
    if (nextIndex >= cards.length) {
      // Sätt tillbaka "kan_inte"-kort sist
      const remaining = cards.filter(c => c.status !== 'kan');
      if (remaining.length > 0) {
        setCards(remaining.map(c => ({ ...c, status: null })));
        setCurrent(0);
      }
    } else {
      setCurrent(nextIndex);
    }

    setFlipped(false);
    setAiText('');
    setShowAi(false);
  }, [cards, current]);

  const handleAiExplain = async () => {
    const card = cards[current];
    if (!card) return;
    setShowAi(true);
    setAiLoading(true);
    setAiText('');
    await explainWord(
      card.word,
      card.question.question_text,
      (chunk) => setAiText(prev => prev + chunk),
      () => setAiLoading(false),
      (err) => { setAiText(`Fel: ${err}`); setAiLoading(false); }
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-ki-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-16 text-ki-gray-dark">
        <div className="text-4xl mb-3">📭</div>
        <p>Inga ORD-frågor hittades.</p>
        <p className="text-sm mt-1">Kör scraping för att fylla databasen.</p>
      </div>
    );
  }

  // Alla kort klara
  if (current >= cards.length) {
    const total = sessionStats.kan + sessionStats.osäker + sessionStats.kan_inte;
    return (
      <div className="max-w-md mx-auto text-center space-y-6 animate-slide-up">
        <div className="card">
          <div className="text-5xl mb-3">🎯</div>
          <h2 className="text-2xl font-bold text-ki-text">Session klar!</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="bg-green-50 rounded-xl p-3">
              <div className="text-2xl font-bold text-green-600">{sessionStats.kan}</div>
              <div className="text-xs text-green-700">Kan</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3">
              <div className="text-2xl font-bold text-amber-600">{sessionStats.osäker}</div>
              <div className="text-xs text-amber-700">Osäker</div>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <div className="text-2xl font-bold text-red-600">{sessionStats.kan_inte}</div>
              <div className="text-xs text-red-700">Kan inte</div>
            </div>
          </div>
          <p className="text-sm text-ki-gray-dark mt-3">
            {total > 0 ? `${Math.round((sessionStats.kan / total) * 100)}% kan` : ''}
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary w-full py-3"
        >
          Ny session
        </button>
      </div>
    );
  }

  const card = cards[current];
  const progress = ((current) / cards.length) * 100;

  return (
    <div className="max-w-lg mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ki-text">ORD-Flashcards</h1>
        <span className="text-sm text-ki-gray-dark">{current + 1} / {cards.length}</span>
      </div>

      {/* Progress */}
      <div className="w-full h-1.5 bg-ki-gray-mid rounded-full">
        <div
          className="h-1.5 bg-ki-blue rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Flashcard */}
      <div className="flip-card h-64 cursor-pointer" onClick={handleFlip}>
        <div className={`flip-card-inner h-full ${flipped ? 'flipped' : ''}`}>
          {/* Framsida — ordet */}
          <div className="flip-card-front card flex flex-col items-center justify-center h-full">
            <div className="text-xs text-ki-gray-dark mb-4 uppercase tracking-wide">Ord</div>
            <div className="text-4xl font-bold text-ki-blue text-center">
              {card.word}
            </div>
            <div className="text-xs text-ki-gray-dark mt-6">Tryck för att vända</div>
          </div>

          {/* Baksida — svarsalternativ */}
          <div className="flip-card-back card flex flex-col justify-center h-full">
            <div className="text-xs text-ki-gray-dark mb-3 uppercase tracking-wide text-center">Fråga</div>
            <p className="text-sm text-ki-text text-center mb-4 leading-relaxed">
              {card.question.question_text}
            </p>
            <div className="space-y-1.5">
              {(['A', 'B', 'C', 'D', 'E'] as const).map(k => {
                const text = card.question[`option_${k.toLowerCase()}` as keyof Question] as string | null;
                if (!text) return null;
                return (
                  <div
                    key={k}
                    className={`flex gap-2 text-xs p-2 rounded ${
                      card.question.correct_answer === k
                        ? 'bg-green-50 text-green-800 font-medium'
                        : 'text-ki-gray-dark'
                    }`}
                  >
                    <span className="font-mono font-bold">{k})</span>
                    <span>{text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Svarsknapppar */}
      {flipped && (
        <div className="grid grid-cols-3 gap-3 animate-slide-up">
          <button
            onClick={() => handleStatus('kan_inte')}
            className="py-3 rounded-xl bg-red-50 border-2 border-red-200 text-red-700 font-medium text-sm hover:bg-red-100 transition-colors"
          >
            😰 Kan inte
          </button>
          <button
            onClick={() => handleStatus('osäker')}
            className="py-3 rounded-xl bg-amber-50 border-2 border-amber-200 text-amber-700 font-medium text-sm hover:bg-amber-100 transition-colors"
          >
            🤔 Osäker
          </button>
          <button
            onClick={() => handleStatus('kan')}
            className="py-3 rounded-xl bg-green-50 border-2 border-green-200 text-green-700 font-medium text-sm hover:bg-green-100 transition-colors"
          >
            ✓ Kan!
          </button>
        </div>
      )}

      {/* AI-ordbok */}
      {flipped && (
        <div>
          {!showAi ? (
            <button
              onClick={handleAiExplain}
              className="text-sm text-ki-blue hover:text-ki-blue-light flex items-center gap-1 transition-colors"
            >
              <span>✨</span>
              <span>Förklara detta ord</span>
            </button>
          ) : (
            <div className="card bg-ki-blue-pale">
              <div className="text-xs font-semibold text-ki-blue mb-2">AI-Ordbok</div>
              {aiLoading && !aiText && (
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-ki-blue rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-ki-blue rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-ki-blue rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              )}
              <div className="text-sm text-ki-text leading-relaxed whitespace-pre-wrap">{aiText}</div>
              {aiLoading && aiText && <span className="inline-block w-1 h-4 bg-ki-blue animate-pulse" />}
            </div>
          )}
        </div>
      )}

      {/* Session-statistik */}
      <div className="flex justify-center gap-4 text-xs text-ki-gray-dark">
        <span className="text-green-600 font-medium">✓ {sessionStats.kan}</span>
        <span className="text-amber-600 font-medium">~ {sessionStats.osäker}</span>
        <span className="text-red-500 font-medium">✗ {sessionStats.kan_inte}</span>
      </div>
    </div>
  );
}
