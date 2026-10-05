import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { authenticate, requireAppHeader } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { authRouter } from './routes/auth.js';
import { recordsRouter } from './routes/records.js';
import { calcRouter } from './routes/calc.js';
import { usersRouter } from './routes/users.js';
import { weightsRouter } from './routes/weights.js';
import { publicRouter } from './routes/public.js';
import { samplesRouter } from './routes/samples.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '5mb' })); // photos arrive as downsized data URLs

  app.set('trust proxy', 'loopback');
  app.use('/api', requireAppHeader);
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/records', authenticate, recordsRouter);
  app.use('/api/weights', authenticate, weightsRouter);
  app.use('/api/users', authenticate, usersRouter);
  app.use('/api/calc', authenticate, calcRouter);
  app.use('/api/samples', authenticate, samplesRouter);

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
