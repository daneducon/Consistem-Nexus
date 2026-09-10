import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from './config';
import { searchRouter } from './routes/searchRoute';
import { syncRouter } from './routes/syncRoute';
import { qualityRouter } from './routes/qualityRoute';
import { authRouter } from './routes/authRoute';
import { authenticateGoogleUser } from './middleware/authenticateGoogleUser';
import { getKnowledgeBase, getKnowledgeBaseStatus } from './services/knowledgeBaseService';

export const app = express();

app.disable('x-powered-by');
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
