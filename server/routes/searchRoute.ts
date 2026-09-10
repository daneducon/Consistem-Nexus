import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getKnowledgeBase } from '../services/knowledgeBaseService';
import { createExactMatchResponse, findExactProgramMatches, rankSearchCandidates } from '../services/hybridSearchService';
import { searchWithOpenRouter } from '../services/openRouterService';

const requestSchema = z.object({
  query: z.string().trim().min(3).max(300),
});

export const searchRouter = Router();

searchRouter.post(
  '/',
  rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Muitas buscas em pouco tempo. Aguarde um minuto e tente novamente.' },
  }),
  async (request, response) => {
    const parsedRequest = requestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      response.status(400).json({ message: 'Digite uma busca entre 3 e 300 caracteres.' });
      return;
    }

    try {
      const knowledgeBase = await getKnowledgeBase();
      if (!knowledgeBase.updatedAt) throw new Error('Base de conhecimento indisponível');

      const exactMatches = findExactProgramMatches(parsedRequest.data.query, knowledgeBase.items);
      if (exactMatches.length > 0) {
        response.json(createExactMatchResponse(parsedRequest.data.query, exactMatches, knowledgeBase.updatedAt));
        return;
      }

      const candidates = rankSearchCandidates(parsedRequest.data.query, knowledgeBase.items);
      const result = await searchWithOpenRouter(
        parsedRequest.data.query,
        candidates,
        knowledgeBase.updatedAt,
      );
      response.json(result);
    } catch (error) {
      console.error(JSON.stringify({
        event: 'search_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
      response.status(503).json({
        message: 'Não foi possível consultar os materiais agora. Tente novamente em alguns instantes.',
      });
    }
  },
);
