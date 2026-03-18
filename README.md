# Jinka Clone

An Egypt-focused real estate aggregator inspired by Jinka, built as a pnpm monorepo.

The current product is split into two authenticated experiences:

- Customer: alert-first, announcement-driven flow
- Admin: operations, review, ingestion, and fraud tooling

## Stack

- Frontend: Next.js 15, React 19, Tailwind CSS
- Backend: NestJS
- Data: PostgreSQL + PostGIS via Prisma
- Queueing: Redis + BullMQ
- Object storage: MinIO
- Crawler: Crawlee + Playwright-capable worker pipeline

## Monorepo Layout

```text
apps/
  api/       NestJS backend
  crawler/   ingestion, alert matching, notification pipeline
  web/       Next.js frontend
packages/
  config/    shared env schema and constants
  fixtures/  fixtures and sample data
  types/     shared types
  ui/        shared UI primitives
```

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker with Docker Compose

## Quick Start

1. Install dependencies:

```bash
pnpm install
```

2. Create your local env file:

```bash
cp .env.example .env
```

3. Start infrastructure:

```bash
docker compose up -d postgres redis minio
```

4. Run database migrations and seed the demo admin:

```bash
set -a; source .env; set +a; pnpm --filter @jinka-eg/api exec prisma migrate deploy
set -a; source .env; set +a; pnpm --filter @jinka-eg/api prisma:seed
```

5. Start the backend and frontend:

```bash
set -a; source .env; set +a; pnpm --filter @jinka-eg/api dev
set -a; source .env; set +a; pnpm --filter @jinka-eg/web dev
```

6. Start the crawler worker and run a one-off ingest if you want alerts to produce announcements:

```bash
set -a; source .env; set +a; pnpm --filter @jinka-eg/crawler worker
set -a; source .env; set +a; pnpm --filter @jinka-eg/crawler ingest:once
```

## Local URLs

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

## Demo Sign-In

- Email: `demo@example.com`
- In local development, OTP preview is returned by the auth flow and shown in the UI.

The seed script ensures `demo@example.com` exists as an admin user.

## Important Product Behavior

- Creating an alert does not automatically generate announcements on its own.
- Announcements are created when the crawler processes listings through the matching pipeline.
- If you want to see announcement activity locally, you need the crawler worker running and at least one ingest or scheduled crawl.

## Useful Commands

### Root

```bash
pnpm build
pnpm test
pnpm typecheck
```

### API

```bash
pnpm --filter @jinka-eg/api dev
pnpm --filter @jinka-eg/api test
pnpm --filter @jinka-eg/api typecheck
pnpm --filter @jinka-eg/api prisma:seed
```

### Web

```bash
pnpm --filter @jinka-eg/web dev
pnpm --filter @jinka-eg/web test
pnpm --filter @jinka-eg/web typecheck
```

### Crawler

```bash
pnpm --filter @jinka-eg/crawler worker
pnpm --filter @jinka-eg/crawler ingest:once
pnpm --filter @jinka-eg/crawler schedule:once
pnpm --filter @jinka-eg/crawler test
pnpm --filter @jinka-eg/crawler typecheck
```

## Environment

The repo includes `.env.example` with the expected local defaults:

- `DATABASE_URL`
- `REDIS_URL`
- `S3_ENDPOINT`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET_RAW`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_URL`
- optional Google OAuth, Mapbox, Sentry, and web-push settings

## Current UX Direction

- Customer UX is modeled as Jinka-like and alert-first:
  create alerts, receive announcements, open matched listings
- Admin UX inherits the same product language but is focused on:
  connector health, ingestion runs, fraud review, cluster review, reports, and blacklists

## Verification

A solid local smoke path is:

```bash
docker compose up -d postgres redis minio
set -a; source .env; set +a; pnpm --filter @jinka-eg/api exec prisma migrate deploy
set -a; source .env; set +a; pnpm --filter @jinka-eg/api prisma:seed
set -a; source .env; set +a; pnpm --filter @jinka-eg/api dev
set -a; source .env; set +a; pnpm --filter @jinka-eg/web dev
set -a; source .env; set +a; pnpm --filter @jinka-eg/crawler worker
set -a; source .env; set +a; pnpm --filter @jinka-eg/crawler ingest:once
```

Then:

- open the frontend
- sign in as `demo@example.com`
- create an alert
- check the announcements page after the crawl completes
