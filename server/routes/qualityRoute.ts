import { Router } from 'express';
import { getKnowledgeBase, getKnowledgeBaseQuality } from '../services/knowledgeBaseService';

export const qualityRouter = Router();

qualityRouter.get('/', async (_request, response) => {
  try {
    await getKnowledgeBase();
    response.json(getKnowledgeBaseQuality());
  } catch {
    response.status(503).json({
      message: 'Não foi possível carregar o relatório de qualidade agora.',
    });
  }
});
