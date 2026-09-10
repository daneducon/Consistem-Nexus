import type { NextFunction, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';

const oauthClient = new OAuth2Client(config.googleOAuthClientId);

export async function authenticateGoogleUser(request: Request, response: Response, next: NextFunction) {
  const authorization = request.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (!token) {
    response.status(401).json({ message: 'Entre com sua conta corporativa para continuar.' });
    return;
  }

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken: token,
      audience: config.googleOAuthClientId,
    });
    const payload = ticket.getPayload();
    const emailDomain = payload?.email?.split('@').at(-1)?.toLowerCase();

    if (!payload?.email || !payload.email_verified || emailDomain !== config.googleAllowedDomain) {
      response.status(403).json({ message: 'Use uma conta autorizada do domínio corporativo.' });
      return;
    }

    response.locals.user = {
      email: payload.email,
      name: payload.name ?? payload.email,
    };
    next();
  } catch {
    response.status(401).json({ message: 'Sua sessão expirou. Entre novamente para continuar.' });
  }
}
