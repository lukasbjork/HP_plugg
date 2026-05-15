import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import type { SectionStats } from '../types';

const router = Router();

async function getSectionStats(): Promise<Record<string, SectionStats>> {
  const db = getDb();

  const questionCounts = (await db.query(
    'SELECT section, COUNT(*) as total FROM questions GROUP BY section'
  )) as { section: string; total: number }[];

  const answerStats = (await db.query(`
    SELECT q.section, COUNT(*) as answered, SUM(ua.is_correct) as correct
    FROM user_answers ua
    JOIN questions q ON ua.question_id = q.id
    GROUP BY q.section
  `)) as { section: string; answered: number; correct: number }[];

  const result: Record<string, SectionStats> = {};
  for (const qc of questionCounts) {
    const ans = answerStats.find(a => a.section === qc.section);
    const answered = ans?.answered ?? 0;
    const correct = ans?.correct ?? 0;
    result[qc.section] = {
      answered,
      correct,
      accuracy: answered > 0 ? correct / answered : 0,
      totalQuestions: qc.total,
    };
  }
  return result;
}

// GET /stats – aggregerad statistik
router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getDb();

    const totals = (await db.get(
      'SELECT COUNT(*) as totalAnswered, SUM(is_correct) as totalCorrect FROM user_answers'
    )) as { totalAnswered: number; totalCorrect: number } | undefined;

    const totalAnswered = totals?.totalAnswered ?? 0;
    const totalCorrect = totals?.totalCorrect ?? 0;
    const accuracy = totalAnswered > 0 ? totalCorrect / totalAnswered : 0;

    const perSection = await getSectionStats();

    const sectionCount = Object.keys(perSection).length || 1;
    const maxContribution = 2.0 / sectionCount;
    let estimatedHpScore = 0;
    for (const stats of Object.values(perSection)) {
      if (stats.answered > 0) estimatedHpScore += stats.accuracy * maxContribution;
    }

    const streakData = (await db.query(`
      SELECT DISTINCT date(answered_at) as day FROM user_answers ORDER BY day DESC
    `)) as { day: string }[];

    let streak = 0;
    if (streakData.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      let currentDay = today;
      for (const { day } of streakData) {
        if (day === currentDay) {
          streak++;
          const d = new Date(currentDay);
          d.setDate(d.getDate() - 1);
          currentDay = d.toISOString().split('T')[0];
        } else break;
      }
    }

    res.json({
      totalAnswered,
      totalCorrect,
      accuracy,
      perSection,
      estimatedHpScore: Math.round(estimatedHpScore * 100) / 100,
      streak,
    });
  } catch (err) {
    console.error('Fel vid hämtning av statistik:', err);
    res.status(500).json({ error: 'Kunde inte hämta statistik' });
  }
});

// GET /stats/weak-areas – sektioner med lägst träffsäkerhet
router.get('/weak-areas', async (_req: Request, res: Response) => {
  try {
    const perSection = await getSectionStats();
    const weakAreas = Object.entries(perSection)
      .filter(([, stats]) => stats.answered >= 5)
      .sort((a, b) => a[1].accuracy - b[1].accuracy)
      .slice(0, 3)
      .map(([section, stats]) => ({ section, ...stats }));
    res.json({ weakAreas });
  } catch (err) {
    console.error('Fel vid hämtning av svaga områden:', err);
    res.status(500).json({ error: 'Kunde inte hämta svaga områden' });
  }
});

// GET /stats/streak
router.get('/streak', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const days = (await db.query(`
      SELECT DISTINCT date(answered_at) as day FROM user_answers ORDER BY day DESC
    `)) as { day: string }[];

    let streak = 0;
    if (days.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      let currentDay = today;
      for (const { day } of days) {
        if (day === currentDay) {
          streak++;
          const d = new Date(currentDay);
          d.setDate(d.getDate() - 1);
          currentDay = d.toISOString().split('T')[0];
        } else break;
      }
    }
    res.json({ streak });
  } catch (err) {
    console.error('Fel vid beräkning av streak:', err);
    res.status(500).json({ error: 'Kunde inte beräkna streak' });
  }
});

// GET /stats/history – daglig historik för heatmap
router.get('/history', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const history = (await db.query(`
      SELECT date(answered_at) as date, COUNT(*) as count
      FROM user_answers
      WHERE answered_at >= date('now', '-365 days')
      GROUP BY date(answered_at)
      ORDER BY date ASC
    `)) as { date: string; count: number }[];
    res.json({ history });
  } catch (err) {
    console.error('Fel vid hämtning av historik:', err);
    res.status(500).json({ error: 'Kunde inte hämta historik' });
  }
});

// GET /stats/section-history – resultatutveckling per sektion
router.get('/section-history', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const section = req.query.section as string | undefined;
    const days = req.query.days ? Number(req.query.days) : 30;
    const params: unknown[] = [days];
    const sectionCondition = section ? (params.push(section), 'AND q.section = ?') : '';

    const history = (await db.query(`
      SELECT
        date(ua.answered_at) as date,
        q.section,
        COUNT(*) as answered,
        SUM(ua.is_correct) as correct,
        ROUND(CAST(SUM(ua.is_correct) AS FLOAT) / COUNT(*), 3) as accuracy
      FROM user_answers ua
      JOIN questions q ON ua.question_id = q.id
      WHERE ua.answered_at >= date('now', '-' || ? || ' days')
      ${sectionCondition}
      GROUP BY date(ua.answered_at), q.section
      ORDER BY date ASC, q.section ASC
    `, params)) as { date: string; section: string; answered: number; correct: number; accuracy: number }[];

    res.json({ history });
  } catch (err) {
    console.error('Fel vid hämtning av sektionshistorik:', err);
    res.status(500).json({ error: 'Kunde inte hämta sektionshistorik' });
  }
});

export default router;
