import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  PII_ENC_KEY: z.string().base64().refine((v) => Buffer.from(v, "base64").length === 32, {
    message: "PII_ENC_KEY must be a base64 encoded 32 byte key for AES-256-GCM",
  }),
  IP_HASH_SALT: z.string().min(16),
  CRON_SECRET: z.string().min(16),
  APP_URL: z.string().url(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  throw new Error(`Invalid environment variables: ${issues}`);
}

export const env = parsed.data;
