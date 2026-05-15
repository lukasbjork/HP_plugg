// Frågekort med svarsalternativ, feedback och AI-förklaring
import { useState, useRef } from 'react';
import type { Question } from '../lib/types';
import { SectionBadge } from './SectionBadge';
import { submitAnswer, explainQuestion } from '../lib/api';

interface Props {
  question: Question;
  mode: 'practice' | 'simulation' | 'flashcard';
  onAnswered?: (isCorrect: boolean) => void;
  showImmediate?: boolean;    // Visa feedback direkt (övningsläge)
  questionIndex?: number;
  totalQuestions?: number;
}

export function QuestionCard({
  question,
  mode,
  onAnswered,
  showImmediate = true,
  questionIndex,
  totalQuestions,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<{ isCorrect: boolean; correctAnswer: string | null } | null>(null);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const startTimeRef = useRef(Date.now());

  const options: Array<{ key: string; text: string | null }> = [
    { key: 'A', text: question.option_a },
    { key: 'B', text: question.option_b },
    { key: 'C', text: question.option_c },
    { key: 'D', text: question.option_d },
    { key: 'E', text: question.option_e },
  ].filter(o => o.text !== null);

  const answered = result !== null;

  const handleSelect = async (key: string) => {
    if (answered) return;
    setSelected(key);

    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
    const data = await submitAnswer(question.id, key, elapsed, mode);

    if (showImmediate) {
      setResult(data);
    } else {
      // Simuleringsläge: visa inget direkt
      setResult({ isCorrect: data.isCorrect, correctAnswer: data.correctAnswer });
    }

    onAnswered?.(data.isCorrect);
  };

  const handleExplain = async () => {
    setShowAi(true);
    setAiLoading(true);
    setAiText('');
    await explainQuestion(
      question.id,
      (chunk) => setAiText(prev => prev + chunk),
      () => setAiLoading(false),
      (err) => { setAiText(`Fel: ${err}`); setAiLoading(false); }
    );
  };

  const getOptionClass = (key: string) => {
    if (!answered || !showImmediate) {
      return key === selected ? 'answer-option selected' : 'answer-option';
    }
    if (key === result?.correctAnswer) return 'answer-option correct';
    if (key === selected && !result?.isCorrect) return 'answer-option wrong';
    return 'answer-option disabled';
  };

  return (
    <div className="card animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <SectionBadge section={question.section} />
          {question.correct_answer === null && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Inget facit</span>
          )}
        </div>
        {questionIndex !== undefined && totalQuestions !== undefined && (
          <span className="text-sm text-ki-gray-dark">
            {questionIndex + 1} / {totalQuestions}
          </span>
        )}
      </div>

      {/* Frågetext */}
      <p className="text-base text-ki-text leading-relaxed mb-5 whitespace-pre-wrap">
        {question.question_text}
      </p>

      {/* Svarsalternativ */}
      <div className="space-y-2">
        {options.map(({ key, text }) => (
          <button
            key={key}
            onClick={() => handleSelect(key)}
            disabled={answered}
            className={`w-full text-left ${getOptionClass(key)}`}
          >
            <span className="font-mono font-bold text-ki-blue min-w-[1.5rem]">{key}</span>
            <span className="text-ki-text">{text}</span>
          </button>
        ))}
      </div>

      {/* Feedback och AI-förklaring (visas bara i övningsläge) */}
      {answered && showImmediate && (
        <div className="mt-4 pt-4 border-t border-ki-gray-mid">
          <div className={`flex items-center gap-2 mb-3 ${result?.isCorrect ? 'text-green-700' : 'text-red-600'}`}>
            <span className="text-lg">{result?.isCorrect ? '✓' : '✗'}</span>
            <span className="font-medium">
              {result?.isCorrect
                ? 'Rätt svar!'
                : result?.correctAnswer
                ? `Fel. Rätt svar: ${result.correctAnswer}`
                : 'Inget facit tillgängligt'}
            </span>
          </div>

          {/* AI-förklaring */}
          {!showAi ? (
            <button
              onClick={handleExplain}
              className="text-sm text-ki-blue hover:text-ki-blue-light flex items-center gap-1 transition-colors"
            >
              <span>✨</span>
              <span>Förklara denna fråga</span>
            </button>
          ) : (
            <div className="mt-3 p-3 bg-ki-blue-pale rounded-lg">
              <div className="text-xs font-semibold text-ki-blue mb-1">AI-förklaring</div>
              {aiLoading && !aiText && (
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-ki-blue rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-ki-blue rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-ki-blue rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              )}
              <p className="text-sm text-ki-text leading-relaxed whitespace-pre-wrap">{aiText}</p>
              {aiLoading && aiText && <span className="inline-block w-1 h-4 bg-ki-blue animate-pulse ml-0.5" />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
