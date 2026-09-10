import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().min(1).default('google/gemma-4-31b-it'),
  OPENROUTER_SITE_URL: z.url().default('http://localhost:5173'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1),
  GOOGLE_DRIVE_FOLDER_ID: z.string().min(1),
  GOOGLE_SHARED_DRIVE_ID: z.string().optional(),
  GOOGLE_SHEET_NAME: z.string().min(1).default('MATRIZ'),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1),
  GOOGLE_ALLOWED_DOMAIN: z.string().min(1).transform((domain) => domain.toLowerCase()),
  KNOWLEDGE_REFRESH_INTERVAL_MS: z.coerce.number().int().min(60_000).default(900_000),
  DRIVE_CHANGES_POLL_INTERVAL_MS: z.coerce.number().int().min(30_000).default(60_000),
  KNOWLEDGE_CACHE_PATH: z.string().min(1).default('.data/knowledge-base.json'),
  APP_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const variables = parsedEnvironment.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Variaveis de ambiente invalidas ou ausentes: ${variables}`);
}

const environment = parsedEnvironment.data;

export const config = {
  openRouterApiKey: environment.OPENROUTER_API_KEY,
  openRouterModel: environment.OPENROUTER_MODEL,
  openRouterSiteUrl: environment.OPENROUTER_SITE_URL,
  googleCredentialsPath: environment.GOOGLE_APPLICATION_CREDENTIALS,
  googleDriveFolderId: environment.GOOGLE_DRIVE_FOLDER_ID,
  googleSharedDriveId: environment.GOOGLE_SHARED_DRIVE_ID,
  googleSheetName: environment.GOOGLE_SHEET_NAME,
  googleOAuthClientId: environment.GOOGLE_OAUTH_CLIENT_ID,
  googleAllowedDomain: environment.GOOGLE_ALLOWED_DOMAIN,
  refreshIntervalMs: environment.KNOWLEDGE_REFRESH_INTERVAL_MS,
  changesPollIntervalMs: environment.DRIVE_CHANGES_POLL_INTERVAL_MS,
  knowledgeCachePath: environment.KNOWLEDGE_CACHE_PATH,
  appOrigins: environment.APP_ORIGIN.split(',').map((origin) => origin.trim()),
  port: environment.PORT,
};
