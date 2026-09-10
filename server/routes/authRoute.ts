import { Router } from 'express';
import { config } from '../config.js';
import { authenticateGoogleUser } from '../middleware/authenticateGoogleUser.js';

export const authRouter = Router();

authRouter.get('/config', (_request, response) => {
  response.json({ clientId: config.googleOAuthClientId });
});

authRouter.get('/me', authenticateGoogleUser, (_request, response) => {
  response.json(response.locals.user);
});
