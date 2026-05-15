// Express-server för HP-studiewebbplats
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import examsRouter from './routes/exams';
import questionsRouter from './routes/questions';
import statsRouter from './routes/stats';
import aiRouter from './routes/ai';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }));
app.use(express.json());

// API-routes
app.use('/api/exams', examsRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/ai', aiRouter);

// Hälsokontroll
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global felhanterare
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Ohanterat fel:', err);
  res.status(500).json({ error: 'Internt serverfel' });
});

export { app };

if (!process.env.NETLIFY) {
  app.listen(PORT, () => {
    console.log(`\nServern körs på http://localhost:${PORT}`);
    console.log(`   API: http://localhost:${PORT}/api`);
    console.log(`   Databas: ${process.env.DATABASE_PATH ?? './database/hp.db'}\n`);
  });
}
