import { z } from "zod";

export const sharedEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  S3_ENDPOINT: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET_RAW: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  MAPBOX_TOKEN: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  EMAIL_FROM: z.string().email(),
  SES_REGION: z.string().min(1),
  WEB_PUSH_PUBLIC_KEY: z.string().optional(),
  WEB_PUSH_PRIVATE_KEY: z.string().optional()
});

export type SharedEnv = z.infer<typeof sharedEnvSchema>;

export const appLocales = ["en", "ar"] as const;

export const sourceReputation: Record<string, number> = {
  nawy: 0.95,
  property_finder: 0.92,
  aqarmap: 0.88,
  facebook: 0.62
};

export const queueNames = [
  "seed-source",
  "discover-page",
  "fetch-detail",
  "reconcile-variant",
  "score-cluster",
  "score-fraud",
  "match-alerts",
  "send-notification"
] as const;
