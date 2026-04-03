import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  API_VERSION: z.string().default('v1'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  RAFIKI_AUTH_SERVER_URL: z.string().url(),
  RAFIKI_RESOURCE_SERVER_URL: z.string().url(),
  QUICKSEND_PLATFORM_WALLET_ADDRESS: z.string().url(),
  RAFIKI_SERVICE_TOKEN: z.string().default(''),
  RAFIKI_WEBHOOK_SECRET: z.string().min(16),

  BCRYPT_ROUNDS: z.coerce.number().default(12),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_SEND_MAX: z.coerce.number().default(10),

  CORS_ORIGINS: z.string().default('http://localhost:8081'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('debug'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    result.error.issues.forEach((issue) => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }
  return result.data;
}

const env = loadConfig();

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  apiVersion: env.API_VERSION,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',

  databaseUrl: env.DATABASE_URL,
  redisUrl: env.REDIS_URL,

  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },

  rafikiAuthServerUrl: env.RAFIKI_AUTH_SERVER_URL,
  rafikiResourceServerUrl: env.RAFIKI_RESOURCE_SERVER_URL,
  platformWalletAddress: env.QUICKSEND_PLATFORM_WALLET_ADDRESS,
  rafikiServiceToken: env.RAFIKI_SERVICE_TOKEN,
  rafikiWebhookSecret: env.RAFIKI_WEBHOOK_SECRET,

  bcryptRounds: env.BCRYPT_ROUNDS,
  rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: env.RATE_LIMIT_MAX,
  rateLimitSendMax: env.RATE_LIMIT_SEND_MAX,

  corsOrigins: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
  logLevel: env.LOG_LEVEL,
};
