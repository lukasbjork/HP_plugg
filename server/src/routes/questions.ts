import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import type { Question, UserAnswer, AnswerBody, SaveBody } from '../types';

const router = Router();

// GET /questions – returnerar frågor med filter
router.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (req.query.section) {
      const sections = (req.query.section as string).split(',').map(s => s.trim());
      conditions.push(`q.section IN (${sections.map(() => '?').join(', ')})`);
      params.push(...sections);
    }
    if (req.query.term) {
      conditions.push('e.term = ?');
      params.push(req.query.term as string);
    }
    if (req.query.year) {
      const year = Number(req.query.year);
      if (!isNaN(year)) { conditions.push('e.year = ?'); params.push(year); }
    }
    if (req.query.difficulty) {
      const difficulties = (req.query.difficulty as string).split(',').map(Number).filter(d => !isNaN(d));
      if (difficulties.length > 0) {
        conditions.push(`q.difficulty IN (${difficulties.map(() => '?').join(', ')})`);
        params.push(...difficulties);
      }
    }
    if (req.query.unanswered === 'true') {
      conditions.push('q.id NOT IN (SELECT DISTINCT question_id FROM user_answers)');
    }
    if (req.query.saved === 'true') {
      conditions.push('q.id IN (SELECT question_id FROM saved_questions)');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const orderBy = req.query.random === 'true' ? 'ORDER BY RANDOM()' : 'ORDER BY q.exam_id, q.question_number';

    const countSql = `SELECT COUNT(*) as total FROM questions q LEFT JOIN exams e ON q.exam_id = e.id ${whereClause}`;
    const countResult = await db.get(countSql, params) as { total: number };

    const sql = `SELECT q.* FROM questions q LEFT JOIN exams e ON q.exam_id = e.id ${whereClause} ${orderBy} LIMIT ? OFFSET ?`;
    const questions = (await db.query(sql, [...params, limit, offset])) as unknown as Question[];

    res.json({ questions, total: countResult?.total ?? 0 });
  } catch (err) {
    console.error('Fel vid hämtning av frågor:', err);
    res.status(500).json({ error: 'Kunde inte hämta frågor' });
  }
});

// GET /questions/:id – returnerar en enskild fråga med svarshistorik
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Ogiltigt id' });

    const db = getDb();
    const question = (await db.get('SELECT * FROM questions WHERE id = ?', [id])) as Question | undefined;
    if (!question) return res.status(404).json({ error: 'Frågan hittades inte' });

    const answers = (await db.query('SELECT * FROM user_answers WHERE question_id = ? ORDER BY answered_at DESC', [id])) as unknown as UserAnswer[];
    const saved = await db.get('SELECT * FROM saved_questions WHERE question_id = ?', [id]);

    res.json({ question, answers, saved: !!saved });
  } catch (err) {
    console.error('Fel vid hämtning av fråga:', err);
    res.status(500).json({ error: 'Kunde inte hämta frågan' });
  }
});

// POST /questions/:id/answer – sparar ett svar och uppdaterar svårighetsgrad
router.post('/:id/answer', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Ogiltigt id' });

    const db = getDb();
    const question = (await db.get('SELECT * FROM questions WHERE id = ?', [id])) as Question | undefined;
    if (!question) return res.status(404).json({ error: 'Frågan hittades inte' });

    const { selectedAnswer, timeSpentSeconds, mode } = req.body as AnswerBody;
    if (!selectedAnswer) return res.status(400).json({ error: 'selectedAnswer krävs' });

    const isCorrect = question.correct_answer
      ? selectedAnswer.toUpperCase() === question.correct_answer.toUpperCase() ? 1 : 0
      : 0;

    await db.run(
      `INSERT INTO user_answers (question_id, selected_answer, is_correct, time_spent_seconds, answered_at, mode) VALUES (?, ?, ?, ?, datetime('now'), ?)`,
      [id, selectedAnswer, isCorrect, timeSpentSeconds ?? 0, mode ?? 'övning']
    );

    // Uppdatera svårighetsgrad baserat på felfrekvens (minst 3 svar)
    const answers = (await db.query('SELECT * FROM user_answers WHERE question_id = ? ORDER BY answered_at DESC', [id])) as unknown as UserAnswer[];
    if (answers.length >= 3) {
      const total = answers.length;
      const correct = answers.filter(a => a.is_correct === 1).length;
      const errorRate = (total - correct) / total;
      let newDifficulty = question.difficulty ?? 3;
      if (errorRate > 0.5) newDifficulty = Math.min(5, newDifficulty + 1);
      else if (errorRate < 0.2) newDifficulty = Math.max(1, newDifficulty - 1);
      if (newDifficulty !== question.difficulty) {
        await db.run('UPDATE questions SET difficulty = ? WHERE id = ?', [newDifficulty, id]);
      }
    }

    res.json({ isCorrect: isCorrect === 1, correctAnswer: question.correct_answer });
  } catch (err) {
    console.error('Fel vid sparande av svar:', err);
    res.status(500).json({ error: 'Kunde inte spara svaret' });
  }
});

// POST /questions/:id/save – sparar en fråga
router.post('/:id/save', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Ogiltigt id' });

    const db = getDb();
    const question = await db.get('SELECT * FROM questions WHERE id = ?', [id]);
    if (!question) return res.status(404).json({ error: 'Frågan hittades inte' });

    const { note } = req.body as SaveBody;
    await db.run('DELETE FROM saved_questions WHERE question_id = ?', [id]);
    await db.run(`INSERT INTO saved_questions (question_id, note, saved_at) VALUES (?, ?, datetime('now'))`, [id, note ?? null]);

    res.json({ saved: true });
  } catch (err) {
    console.error('Fel vid sparande av fråga:', err);
    res.status(500).json({ error: 'Kunde inte spara frågan' });
  }
});

// DELETE /questions/:id/save – tar bort en sparad fråga
router.delete('/:id/save', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Ogiltigt id' });

    const db = getDb();
    await db.run('DELETE FROM saved_questions WHERE question_id = ?', [id]);
    res.json({ saved: false });
  } catch (err) {
    console.error('Fel vid borttagning av sparad fråga:', err);
    res.status(500).json({ error: 'Kunde inte ta bort sparad fråga' });
  }
});

export default router;
