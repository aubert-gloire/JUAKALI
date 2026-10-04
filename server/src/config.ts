import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  APP_ORIGIN: z.string().url('APP_ORIGIN must be a valid URL'),
  CRON_SECRET: z.string().optional(),

  AI_PROVIDER: z.enum(['gemini']).default('gemini'),
  AI_MODEL: z.string().default('gemini-1.5-flash'),
  GEMINI_API_KEY: z.string().optional(),

  BILLING_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  AI_REQUESTS_PER_USER_PER_DAY: z.coerce.number().default(50),
  TRIAL_DAYS: z.coerce.number().default(14),
  GRACE_DAYS: z.coerce.number().default(7),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  parsed.error.issues.forEach((issue) => {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
