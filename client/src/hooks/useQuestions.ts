// Hook för att hämta och hantera frågor
import { useState, useCallback } from 'react';
import { fetchQuestions } from '../lib/api';
import type { Question } from '../lib/types';
import type { QuestionFilter } from '../lib/api';

export function useQuestions(initialFilter: QuestionFilter = {}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<QuestionFilter>(initialFilter);

  const load = useCallback(async (newFilter?: QuestionFilter) => {
    const activeFilter = newFilter ?? filter;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQuestions(activeFilter);
      setQuestions(data.questions);
      setTotal(data.total);
      if (newFilter) setFilter(newFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda frågor');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  return { questions, total, loading, error, load, filter, setFilter };
}
