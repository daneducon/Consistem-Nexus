import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from './config.js';
import { searchRouter } from './routes/searchRoute.js';
import { syncRouter } from './routes/syncRoute.js';
import { qualityRouter } from './routes/qualityRoute.js';
import { authRouter } from './routes/authRoute.js';
import { authenticateGoogleUser } from './middleware/authenticateGoogleUser.js';
import { getKnowledgeBase, getKnowledgeBaseStatus } from './services/knowledgeBaseService.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({ origin: config.appOrigins }));
app.use(express.json({ limit: '16kb' }));

app.use('/api/auth', authRouter);
app.use('/api', authenticateGoogleUser);
app.get('/api/health', async (_request, response) => {
  try {
    await getKnowledgeBase();
    response.json(getKnowledgeBaseStatus());
  } catch {
    response.status(503).json({ message: 'A base de aprendizagem está indisponível.' });
  }
});
app.use('/api/search', searchRouter);
app.use('/api/sync', syncRouter);
app.use('/api/quality', qualityRouter);
app.use('/api', (_request, response) => {
  response.status(404).json({ message: 'Rota não encontrada.' });
});

const distPath = resolve(process.cwd(), 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*path', (_request, response) => response.sendFile(resolve(distPath, 'index.html')));
}
