// AI-routes – Claude-integration för förklaringar, studieplan och ordbok
import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '../db';
import type { Question, StudyPlanBody, WordBody } from '../types';

const router = Router();

// Skapa Anthropic-klient — AI-funktioner är inaktiverade om nyckeln saknas
function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Hjälpfunktion: skicka SSE-event och håll förbindelsen öppen
function sseStart(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

function sseWrite(res: Response, data: string): void {
  res.write(`data: ${data}\n\n`);
}

function sseEnd(res: Response): void {
  res.write('data: [DONE]\n\n');
  res.end();
}

// POST /ai/explain – förklarar en fråga med AI
// Body: { questionId: number }
router.post('/explain', async (req: Request, res: Response) => {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return res.status(503).json({ error: 'AI-funktioner ej konfigurerade. Lägg till ANTHROPIC_API_KEY i .env' });
  }

  try {
    const { questionId } = req.body as { questionId: number };
    if (!questionId) {
      return res.status(400).json({ error: 'questionId krävs' });
    }

    const question = (await getDb().get('SELECT * FROM questions WHERE id = ?', [questionId])) as Question | undefined;

    if (!question) {
      return res.status(404).json({ error: 'Frågan hittades inte' });
    }

    // Bygg en strukturerad beskrivning av frågan
    const questionContext = [
      `Sektion: ${question.section}`,
      `Fråga: ${question.question_text}`,
      question.option_a ? `A) ${question.option_a}` : '',
      question.option_b ? `B) ${question.option_b}` : '',
      question.option_c ? `C) ${question.option_c}` : '',
      question.option_d ? `D) ${question.option_d}` : '',
      question.option_e ? `E) ${question.option_e}` : '',
      question.correct_answer ? `\nRätt svar: ${question.correct_answer}` : '\n(Facit saknas)',
    ]
      .filter(Boolean)
      .join('\n');

    sseStart(res);

    // Streama förklaring med prompt caching för system-prompten
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: 'Du är en expert på det svenska Högskoleprovet. Förklara pedagogiskt och koncist på svenska. Fokusera på varför rätt svar är korrekt och varför de felaktiga alternativen är fel. Håll svaret under 200 ord.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Förklara denna fråga från Högskoleprovet:\n\n${questionContext}`,
        },
      ],
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        sseWrite(res, JSON.stringify({ text: event.delta.text }));
      }
    }

    sseEnd(res);
  } catch (err) {
    console.error('Fel vid AI-förklaring:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Kunde inte generera förklaring' });
    } else {
      sseWrite(res, JSON.stringify({ error: 'Fel vid generering' }));
      sseEnd(res);
    }
  }
});

// POST /ai/study-plan – genererar personlig veckoplan
// Body: { stats: Record<string, SectionStats>, targetDate: string }
router.post('/study-plan', async (req: Request, res: Response) => {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return res.status(503).json({ error: 'AI-funktioner ej konfigurerade' });
  }

  try {
    const { stats, targetDate } = req.body as StudyPlanBody;

    const statsText = Object.entries(stats)
      .map(([section, s]) =>
        `${section}: ${Math.round(s.accuracy * 100)}% rätt (${s.answered} frågor övade av ${s.totalQuestions} totalt)`
      )
      .join('\n');

    sseStart(res);

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: 'Du är en studiecoach specialiserad på det svenska Högskoleprovet. Skapa konkreta, motiverande studieplaner på svenska i Markdown-format. Målet är Karolinska Institutet (läkarprogrammet) som kräver ~2.0 i HP-poäng.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Generera en veckovis studieplan baserad på min statistik:\n\n${statsText}\n\nMål-datum för provet: ${targetDate}\n\nSkapa en Markdown-formaterad plan med: veckoöversikt, fokusområden, dagliga övningsmål och motiverande tips.`,
        },
      ],
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        sseWrite(res, JSON.stringify({ text: event.delta.text }));
      }
    }

    sseEnd(res);
  } catch (err) {
    console.error('Fel vid generering av studieplan:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Kunde inte generera studieplan' });
    } else {
      sseEnd(res);
    }
  }
});

// POST /ai/word – förklarar ett ord för flashcard-läge
// Body: { word: string, context?: string }
router.post('/word', async (req: Request, res: Response) => {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return res.status(503).json({ error: 'AI-funktioner ej konfigurerade' });
  }

  try {
    const { word, context } = req.body as WordBody;
    if (!word) {
      return res.status(400).json({ error: 'word krävs' });
    }

    sseStart(res);

    const contextPart = context ? `\nOrdet förekommer i kontexten: "${context}"` : '';

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: 'Du är en ordbok och språkexpert. Ge koncisa, pedagogiska ordförklaringar på svenska. Format: **Definition**, **Etymologi**, **Synonymer**, **Exempelmening**.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Förklara ordet: "${word}"${contextPart}`,
        },
      ],
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        sseWrite(res, JSON.stringify({ text: event.delta.text }));
      }
    }

    sseEnd(res);
  } catch (err) {
    console.error('Fel vid ordförklaring:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Kunde inte förklara ordet' });
    } else {
      sseEnd(res);
    }
  }
});

export default router;
