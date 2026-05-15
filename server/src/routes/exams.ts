import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import type { Exam } from '../types';

const router = Router();

// GET /exams – returnerar alla prov grupperade per termin
router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const exams = (await db.query('SELECT * FROM exams ORDER BY year DESC, season ASC')) as unknown as Exam[];

    const grouped: Record<string, Exam[]> = {};
    for (const exam of exams) {
      const key = exam.term;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(exam);
    }

    res.json({ exams, grouped });
  } catch (err) {
    console.error('Fel vid hämtning av prov:', err);
    res.status(500).json({ error: 'Kunde inte hämta prov' });
  }
});

// GET /exams/:id – returnerar ett enskilt prov
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Ogiltigt id' });

    const db = getDb();
    const exam = (await db.get('SELECT * FROM exams WHERE id = ?', [id])) as Exam | undefined;
    if (!exam) return res.status(404).json({ error: 'Provet hittades inte' });

    res.json({ exam });
  } catch (err) {
    console.error('Fel vid hämtning av prov:', err);
    res.status(500).json({ error: 'Kunde inte hämta provet' });
  }
});

// GET /exams/:id/questions – returnerar alla frågor för ett prov
// Query-param: ?section=ORD (valfritt)
router.get('/:id/questions', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Ogiltigt id' });

    const db = getDb();
    const exam = await db.get('SELECT * FROM exams WHERE id = ?', [id]);
    if (!exam) return res.status(404).json({ error: 'Provet hittades inte' });

    const section = req.query.section as string | undefined;
    const questions = section
      ? await db.query('SELECT * FROM questions WHERE exam_id = ? AND section = ? ORDER BY question_number', [id, section])
      : await db.query('SELECT * FROM questions WHERE exam_id = ? ORDER BY question_number', [id]);

    res.json({ questions, total: questions.length });
  } catch (err) {
    console.error('Fel vid hämtning av frågor:', err);
    res.status(500).json({ error: 'Kunde inte hämta frågor' });
  }
});

export default router;
