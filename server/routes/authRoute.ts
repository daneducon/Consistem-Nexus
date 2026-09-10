import { Router } from 'express';
import { config } from '../config';
import { authenticateGoogleUser } from '../middleware/authenticateGoogleUser';

export const authRouter = Router();

authRouter.get('/config', (_request, response) => {
  response.json({ clientId: config.googleOAuthClientId });
});

authRouter.get('/me', authenticateGoogleUser, (_request, response) => {
  response.json(response.locals.user);
});
