# Egypt-First Jinka-Style Aggregator

## Summary
- Build a bilingual `ar`/`en` consumer real estate aggregator for **Egypt** inspired by Jinka’s strongest patterns: real-time alerts, multi-source aggregation, duplicate collapse, visible trust signals, favorites, shortlist sharing, and mobile-first search.
- Sources for v1 are `Nawy`, `Property Finder EG`, `Aqarmap`, and limited `Facebook` public or authorized surfaces. `Aqarmap` is treated as anti-bot-heavy from day one. `Facebook` does not rely on unrestricted private-profile scraping.
- Frontend uses `Next.js` as a responsive PWA. Backend uses `NestJS`. Scraping runs in a separate `Crawlee` worker. Search stays on `PostgreSQL + PostGIS` in v1.
- Product scope is consumer-only. Contact flow is deep-link to the source. Off-plan inventory is first-class, but appears in a separate **Projects** tab.

## Current Status
- `Phase 0`: complete.
- `Phase 1`: complete as of March 9, 2026.
- `Phase 2`: complete as of March 9, 2026.
- Local verification completed on March 9, 2026:
  - `docker compose up -d postgres redis minio`
  - `pnpm --filter @jinka-eg/api exec prisma migrate deploy`
  - `pnpm --filter @jinka-eg/api prisma:seed`
  - `pnpm --filter @jinka-eg/api typecheck`
  - `pnpm --filter @jinka-eg/web typecheck`
  - `pnpm --filter @jinka-eg/crawler typecheck`
  - `pnpm --filter @jinka-eg/api test`
  - `pnpm --filter @jinka-eg/crawler test`
  - `pnpm --filter @jinka-eg/api build`
  - `pnpm --filter @jinka-eg/web build`
  - `pnpm --filter @jinka-eg/crawler build`
  - API smoke test for `request-otp -> verify-otp -> GET /v1/me -> PATCH /v1/me`
  - RBAC smoke test for `GET /v1/admin/connectors` returning `200` for admin and `403` for a regular user
  - `pnpm --filter @jinka-eg/crawler ingest:once`
  - Prisma verification of persisted `IngestionRun`, `RawSnapshot`, `ListingVariant`, and `Area` rows for `Nawy` and `Property Finder EG`
  - MinIO verification of replayable raw snapshot objects under `S3_BUCKET_RAW`
- Phase 1 runtime delivered:
  - Prisma-backed `User`, `OtpChallenge`, and `AuthSession` persistence on PostgreSQL + PostGIS
  - seed-backed admin bootstrap for `demo@example.com`
  - NestJS OTP auth, refresh-session support, logout revocation, protected profile endpoints, and admin RBAC
  - Next.js localized sign-in flow, protected app shell, account settings page, locale switching, and logout
  - request logging, structured exception logging, Sentry bootstrap, and OpenTelemetry bootstrap hooks
  - reproducible initial Prisma migration history under `apps/api/prisma/migrations`
- Phase 2 runtime delivered:
  - BullMQ-backed ingestion stages for `seed-source`, `fetch-page`, `parse-snapshot`, and `normalize-variant`, plus no-op downstream stage workers for later phases
  - S3-compatible raw snapshot persistence to MinIO with replayable storage keys captured in `RawSnapshot`
  - live `Nawy` and `Property Finder EG` connectors parsing embedded `__NEXT_DATA__` payloads into normalized variants
  - parser fixtures and replay tooling for `Nawy` and `Property Finder EG`
  - normalized `Area` upserts, fallback geocoding, and media hash enrichment stored with normalized variant payloads
  - Prisma persistence for `IngestionRun`, `RawSnapshot`, `ListingVariant`, `PriceHistory`, and connector health metrics surfaced in admin
  - Next.js admin dashboard wired to live ingestion run and connector health data

## Product Goals
- Let users search rentals, resale, and off-plan inventory across multiple sources from one app.
- Notify users within minutes when a matching listing appears or drops in price.
- Collapse duplicate listings into one canonical card while preserving all source variants.
- Flag risky or suspicious listings with clear explanations before users click out.
- Support bilingual search, display, and filtering with proper RTL behavior.

## Non-Goals for v1
- Native iOS or Android apps.
- Full professional CRM or broker dashboard.
- In-app chat with sellers.
- SEO indexing of aggregated listing detail pages.
- Heavy ML infrastructure or vector search.

## UX and Information Architecture
- Public pages: `/`, `/how-it-works`, `/trust`, `/faq`, `/privacy`, `/terms`.
- Authenticated app pages: `/search/units`, `/search/projects`, `/listing/:id`, `/project/:id`, `/alerts`, `/favorites`, `/shortlists/:id`, `/account`, `/admin`.
- Mobile navigation uses bottom tabs: `Search`, `Alerts`, `Favorites`, `Inbox`, `Account`.
- Desktop uses left rail navigation, persistent filters, and list or map split for search.
- `Units` is the default surface. `Projects` is separate with project cards, developer info, payment-plan highlights, and source handoff links.

## Architecture
- Monorepo: `pnpm` workspaces + `Turborepo`.
- Apps: `apps/web`, `apps/api`, `apps/crawler`.
- Shared packages: `packages/ui`, `packages/types`, `packages/config`, `packages/fixtures`.
- Frontend: `Next.js`, `Tailwind CSS`, `Radix UI`, `next-intl`, `TanStack Query`, `Mapbox GL`.
- Backend: `NestJS`, `Prisma`, targeted raw SQL for `PostGIS`, `BullMQ`.
- Infra: `PostgreSQL 16 + PostGIS`, `Redis 7`, `S3-compatible storage`, `SES`, `web push`, `Sentry`, `OpenTelemetry`.

## Domain Model
- `User`: profile, locale, notification settings, saved preferences.
- `PushSubscription`: browser endpoint, keys, platform metadata.
- `Alert`: normalized saved search with filters, geo constraints, channels, and quiet hours.
- `Favorite`: user-to-listing relation with note, state, and timestamps.
- `Shortlist`: collaborative list with members, comments, and activity log.
- `ListingVariant`: a source-specific listing tied to a source URL and raw snapshot.
- `ListingCluster`: canonical unit-level listing built from one or more variants.
- `Project`: off-plan project or compound entity.
- `Developer`: normalized developer.
- `Area`: hierarchical geography with English and Arabic names and geometry.
- `RawSnapshot`: raw HTML, JSON payloads, screenshots, and parser metadata.
- `PriceHistory`: canonical and per-variant price change log.
- `ClusterEdge`: scored match candidate between variants.
- `FraudAssessment`: rules, model score, operator label, and explanation payload.
- `FraudCase`: review queue entry for suspicious clusters or variants.
- `Report`: user-submitted fake, duplicate, or wrong-info report.
- `IngestionRun`: source crawl run metadata and health stats.

## API Surface
- `POST /v1/auth/email/request-otp`
- `POST /v1/auth/email/verify-otp`
- `GET /v1/auth/google/start`
- `GET /v1/auth/google/callback`
- `GET /v1/me`
- `GET /v1/listings`
- `GET /v1/listings/:id`
- `GET /v1/listings/:id/variants`
- `GET /v1/projects`
- `GET /v1/projects/:id`
- `POST /v1/alerts`
- `PATCH /v1/alerts/:id`
- `POST /v1/alerts/:id/test`
- `GET /v1/alerts`
- `POST /v1/favorites`
- `PATCH /v1/favorites/:id`
- `GET /v1/favorites`
- `POST /v1/shortlists`
- `POST /v1/shortlists/:id/share`
- `POST /v1/reports`
- `GET /v1/notifications`
- `POST /v1/push-subscriptions`
- `GET /v1/admin/connectors`
- `GET /v1/admin/ingestion-runs`
- `GET /v1/admin/fraud-cases`
- `POST /v1/admin/clusters/:id/merge`
- `POST /v1/admin/clusters/:id/split`
- `POST /v1/admin/fraud-cases/:id/resolve`

## Search, Dedup, and Fraud
- Use PostgreSQL full-text search plus `PostGIS` filtering in v1.
- Build separate materialized `search_documents` views for `ListingCluster` and `Project`.
- Dedup strategy:
  - exact source ID or canonical URL
  - phone hash, image perceptual hash, normalized developer or compound, normalized address, geohash, specs, and price delta
  - multilingual title and description similarity
- Fraud strategy:
  - rules plus lightweight logistic regression
  - label output: `safe`, `review`, `high_risk`
  - user-facing explanation plus operator override

## Crawler Architecture
- Each source implements `discover`, `fetch`, `parse`, `normalize`, and `healthcheck`.
- Use `PlaywrightCrawler` for `Nawy` discovery, `Property Finder EG` fallback, `Aqarmap`, and `Facebook`.
- Downgrade to `HttpCrawler` only when a source exposes stable JSON or SSR content.
- Persist every fetch into `RawSnapshot` before parsing.
- Queue stages: `seed-source`, `fetch-page`, `parse-snapshot`, `normalize-variant`, `score-cluster`, `score-fraud`, `match-alerts`, `send-notification`.

## Phased Implementation Plan
### Phase 0: Product and Compliance Baseline
- Finalize Egypt taxonomy, source risk matrix, data retention policy, takedown policy, and wireframes.
- Exit criteria: approved product spec, connector risk policy, and domain glossary.

### Phase 1: Monorepo and Platform Foundation
- Set up workspace, CI, preview environments, Prisma schema, Postgres, Redis, and object storage.
- Implement auth, locale handling, base layouts, RBAC, logging, Sentry, and OpenTelemetry.
- Exit criteria: users can sign in, switch language, and access the protected app shell.
- Status: complete.
- Completed deliverables:
  - `pnpm` workspace and `Turborepo` monorepo with `apps/web`, `apps/api`, `apps/crawler`, and shared packages
  - local infrastructure via Docker Compose for PostgreSQL + PostGIS, Redis, and MinIO
  - initial Prisma migration and seed flow
  - Prisma-backed OTP auth and profile persistence in the API
  - protected localized Next.js app shell and account settings UI
  - admin route protection with role-aware guards
  - observability hooks for request logging, exception logging, Sentry, and OpenTelemetry
- Exit criteria status: met.

### Phase 2: Ingestion Core and First Connectors
- Build raw snapshot storage, connector interface, BullMQ workers, parser fixtures, replay tooling, and production connectors for `Nawy` and `Property Finder EG`.
- Add area normalization, geocoding, media hashing, and ingestion dashboards.
- Exit criteria: normalized variants from two sources flow continuously with replayable evidence.
- Status: complete.
- Completed deliverables:
  - `apps/crawler` queue runtime and worker entrypoints for seed, fetch, parse, normalize, replay, and one-shot ingestion smoke runs
  - live HTML-to-`__NEXT_DATA__` extraction for `Nawy` and `Property Finder EG` with connector-specific normalization
  - persisted raw snapshots in MinIO and replayable snapshot lookup through Prisma
  - parser fixtures for both primary Phase 2 connectors and fixture-backed connector tests
  - normalized area mapping, centroid fallback geocoding, and media hash derivation captured in variant `rawFields`
  - admin ingestion dashboards backed by real `IngestionRun` and connector health data
- Exit criteria status: met.

### Phase 3: Units Search and Alerts MVP
- Implement `ListingCluster`, search API, list or map UI, detail page, favorites, alerts, inbox, web push, and email notifications.
- Add event-driven alert matching and delivery logs.
- Exit criteria: a signed-in user can search units, save an alert, save favorites, and receive a deduped notification for a new matching unit.

### Phase 4: Projects Surface, Dedup, and Fraud
- Add `Project` search and detail, link clusters to projects, implement cluster scoring, review queue, fraud scoring, trust UI, and admin merge or split tooling.
- Add `Aqarmap` after anti-bot validation.
- Exit criteria: duplicates are collapsed, suspicious listings are labeled, and projects are searchable separately from units.

### Phase 5: Facebook, Collaboration, and Launch Hardening
- Add approved `Facebook` ingestion surfaces, shared shortlists, notes, reporting flow, blacklists, parser drift alarms, and support tooling.
- Run load testing, abuse testing, and launch-readiness drills.
- Exit criteria: operations can handle source failures, fraud review, user reports, and traffic spikes.

### Phase 6: Post-Launch Optimization
- Improve ranking, crawl cadence, fraud coefficients, notification relevance, and area or developer normalization.
- Reassess the need for OpenSearch only if Postgres becomes the bottleneck.

## Acceptance Criteria
- A user can discover the same unit from multiple sources as one canonical card.
- A user can create an alert and receive a near-real-time notification for a newly matched unit.
- A user can browse projects separately from units and click through to the source.
- Operators can review suspicious listings, split or merge clusters, and disable failing connectors.
- The app works in Arabic and English with correct RTL support.
- Parser failures or crawl degradation are detected automatically and surfaced in admin.
