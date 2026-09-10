import type { Request, Response } from 'express';

export default async function handler(request: Request, response: Response) {
  try {
    const { app } = await import('../server/app');
    return app(request, response);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Erro desconhecido ao iniciar a API';
    console.error(JSON.stringify({ event: 'serverless_boot_failed', detail }));
    return response.status(500).json({
      message: 'A API não conseguiu carregar a configuração da Vercel.',
      detail,
    });
  }
}
