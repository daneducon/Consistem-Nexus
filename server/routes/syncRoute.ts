import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getKnowledgeBaseStatus, refreshKnowledgeBase } from '../services/knowledgeBaseService';

export const syncRouter = Router();

syncRouter.post(
  '/',
  rateLimit({
    windowMs: 60_000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Aguarde um minuto antes de sincronizar novamente.' },
  }),
  async (_request, response) => {
    try {
      await refreshKnowledgeBase();
      response.json(getKnowledgeBaseStatus());
    } catch (error) {
      console.error(JSON.stringify({
        event: 'manual_sync_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
      response.status(503).json({
        message: 'Não foi possível atualizar a base agora. Verifique o acesso às matrizes e tente novamente.',
      });
    }
  },
);
