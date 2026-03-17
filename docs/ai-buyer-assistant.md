# AI Buyer Assistant

## Summary
- Add an AI-assisted buying workflow on top of existing shortlists.
- Let a user select up to 10 listings, define a buy box, request missing details from brokers over WhatsApp, and receive a structured recommendation.
- Start with approval-first outbound messaging and evidence-backed recommendations.
- Reuse the current `web` shortlist experience, `api` shortlist and listings modules, and `crawler` detail enrichment pipeline where possible.

## Why This Fits The Current Product
- The app already has shortlist collaboration, listing variants, trust signals, favorites, notifications, and source attribution.
- The shortlist is the natural container for a batch evaluation workflow.
- Listing variants already capture multi-source evidence; the assistant can build on that instead of inventing a separate listing model.
- The current architecture already supports asynchronous work through BullMQ and separate API and crawler apps.

## Product Goal
- Help a buyer evaluate multiple properties faster and with higher confidence.

## User Value
- Save time across repetitive broker outreach.
- Surface hidden differences across similar listings.
- Turn unstructured broker replies into a normalized comparison.
- Return a recommendation tied to the user's stated priorities.

## Non-Goals For V1
- Fully autonomous outbound messaging without user approval.
- Negotiation or offer management.
- Voice calling.
- Legal or financial advice.
- One-click "buy this property" decisions with no visible reasoning.

## Experience Principles
- Evidence over vibes: every recommendation cites listing data or broker replies.
- Human in the loop: users approve outbound messages in v1.
- Structured output: the end state is a comparison table and ranked options, not only a chat transcript.
- Clear uncertainty: missing answers stay visibly missing.
- Low spam posture: contact frequency is limited and purposeful.

## Primary User Story
1. The user opens a listing or shortlist and selects up to 10 properties.
2. The user taps `Research with AI`.
3. The user sets preferences such as budget, target area, minimum bedrooms, finishing level, delivery timeline, and any red flags.
4. The assistant reviews the existing listing variants and identifies missing data points.
5. The assistant drafts broker-specific WhatsApp questions.
6. The user approves the messages.
7. The system sends the messages through an approved business messaging provider or opens a handoff flow for manual send.
8. Broker replies are captured, parsed, and normalized into structured facts plus quoted evidence.
9. The assistant refreshes the shortlist with a compare view and a recommendation report.
10. The user sees:
    - best overall match
    - best value
    - safest option
    - listings that still need follow-up

## Proposed UX

### Entry Points
- Listing detail page: add `Add to AI research` beside the existing shortlist CTA.
- Favorites page: allow bulk selection and `Research selected`.
- Shortlist page: add a top-level `Research with AI` action.

### New Screens

#### Research Setup
- Choose or create a shortlist.
- Limit selection to 10 properties.
- Collect a `buy box`:
  - budget ceiling
  - target areas
  - property type
  - intended use: primary home, investment, rental yield, flip
  - must-have criteria
  - deal breakers
  - weighting sliders such as price, location, trust, readiness, resale potential
- Let the user choose outreach mode:
  - `Draft messages only`
  - `Send after my approval`

#### Research Run View
- Status header with phases:
  - `Collecting listing facts`
  - `Preparing broker questions`
  - `Waiting for approval`
  - `Waiting for broker replies`
  - `Analyzing answers`
  - `Ready`
- Timeline of actions and evidence.
- Per-listing cards showing:
  - known facts
  - missing facts
  - broker contact state
  - trust warnings
  - AI notes

#### Approval Screen
- Group drafted WhatsApp messages by listing and broker.
- Show message text, extracted phone source, and expected questions.
- Allow edit before send.
- Require explicit confirmation.

#### Compare And Recommend
- Matrix view of shortlisted listings and normalized fields.
- Recommendation cards:
  - `Best overall`
  - `Best value`
  - `Lowest risk`
  - `Not enough data`
- Explain each ranking with short bullets.
- Show source evidence for each important claim.

## Trust And Safety Requirements
- Never send outreach without a user action in v1.
- Never claim broker confirmation unless a reply exists and is linked to evidence.
- Mark extracted facts with confidence and freshness.
- Respect rate limits per shortlist, broker, and user.
- Persist exact outbound and inbound message bodies for auditability.
- Provide an ops view to pause a user or broker thread if abuse is detected.

## Data Model Proposal

### New Tables

#### BuyerProfile
- `id`
- `userId`
- `name`
- `intent` enum: `primary_home | investment | rental_income | flip`
- `budgetMin`
- `budgetMax`
- `preferredAreas` JSON or relation table later
- `propertyTypes` JSON
- `mustHaves` JSON string array
- `dealBreakers` JSON string array
- `weights` JSON
- `createdAt`
- `updatedAt`

Purpose:
- Stores reusable buy-box preferences for recommendation scoring.

#### ResearchRun
- `id`
- `shortlistId`
- `userId`
- `buyerProfileId`
- `status` enum:
  - `draft`
  - `collecting`
  - `awaiting_approval`
  - `approved`
  - `contacting`
  - `awaiting_replies`
  - `analyzing`
  - `completed`
  - `failed`
  - `canceled`
- `selectedClusterIds` string array
- `requestedFields` JSON
- `summary`
- `recommendedClusterId`
- `failureReason`
- `createdAt`
- `updatedAt`
- `completedAt`

Purpose:
- Represents one end-to-end buyer-assistant session.

#### ResearchListing
- `id`
- `researchRunId`
- `clusterId`
- `status` enum:
  - `pending`
  - `collecting`
  - `awaiting_broker`
  - `ready`
  - `insufficient_data`
- `scoreOverall`
- `scoreValue`
- `scoreRisk`
- `scoreFit`
- `recommendationLabel` enum:
  - `best_overall`
  - `best_value`
  - `lowest_risk`
  - `consider`
  - `reject`
  - `needs_info`
- `recommendationReasons` JSON string array
- `missingFields` JSON string array
- `createdAt`
- `updatedAt`

Purpose:
- Stores per-listing evaluation status and ranking outputs.

#### ResearchFact
- `id`
- `researchListingId`
- `fieldKey`
- `fieldLabel`
- `valueText`
- `valueJson`
- `sourceType` enum: `listing_variant | broker_reply | user_input | agent_inference`
- `sourceRefId`
- `evidenceSnippet`
- `confidence`
- `freshnessAt`
- `createdAt`

Purpose:
- Normalized facts used in the compare table and recommendation engine.

#### BrokerThread
- `id`
- `researchRunId`
- `clusterId`
- `variantId`
- `brokerName`
- `brokerPhone`
- `contactSource`
- `status` enum:
  - `drafted`
  - `approved`
  - `sent`
  - `replied`
  - `closed`
  - `failed`
- `lastMessageAt`
- `createdAt`
- `updatedAt`

Purpose:
- Tracks the contact channel for one broker and listing.

#### BrokerMessage
- `id`
- `brokerThreadId`
- `direction` enum: `outbound | inbound`
- `messageBody`
- `providerMessageId`
- `sentAt`
- `receivedAt`
- `deliveryStatus`
- `rawPayload` JSON
- `createdAt`

Purpose:
- Full audit trail of outbound and inbound communication.

#### RecommendationReport
- `id`
- `researchRunId`
- `bestOverallClusterId`
- `bestValueClusterId`
- `lowestRiskClusterId`
- `reportMarkdown`
- `reportJson`
- `createdAt`

Purpose:
- Snapshot of the final recommendation.

### Prisma Notes
- Keep the existing `Shortlist`, `ShortlistItem`, and `ListingCluster` tables unchanged for the first iteration.
- Link `ResearchRun.shortlistId` to the current shortlist model.
- Prefer JSON columns for flexible v1 structures like weights, must-haves, and normalized facts.
- Add indexes on:
  - `ResearchRun.userId, createdAt desc`
  - `ResearchRun.shortlistId`
  - `ResearchListing.researchRunId, clusterId`
  - `BrokerThread.researchRunId, clusterId`
  - `BrokerMessage.brokerThreadId, createdAt`

## API Proposal

### New Endpoints

#### Buyer Profiles
- `GET /v1/buyer-profiles`
- `POST /v1/buyer-profiles`
- `PATCH /v1/buyer-profiles/:id`

#### Research Runs
- `POST /v1/shortlists/:id/research-runs`
  - create a run from a shortlist and selected cluster IDs
- `GET /v1/shortlists/:id/research-runs`
  - list past runs
- `GET /v1/research-runs/:id`
  - return run status, per-listing progress, facts, threads, and report
- `POST /v1/research-runs/:id/prepare-outreach`
  - generate message drafts and missing-question sets
- `POST /v1/research-runs/:id/approve-outreach`
  - confirm selected drafts for sending
- `POST /v1/research-runs/:id/cancel`
  - cancel pending work
- `POST /v1/research-runs/:id/reanalyze`
  - rerun ranking after new replies or changed weights

#### Broker Threads
- `GET /v1/research-runs/:id/broker-threads`
- `PATCH /v1/broker-threads/:id`
  - edit phone, broker name, or status
- `POST /v1/broker-threads/:id/messages`
  - manual logging or resend support

#### Webhook Intake
- `POST /v1/integrations/whatsapp/webhook`
  - receive provider delivery events and inbound broker replies

### API Response Shape Notes
- Reuse existing listing cluster payloads where possible.
- Expose facts in a normalized list and a compare-ready keyed object.
- Return evidence metadata with every AI-generated recommendation reason.

## Worker And Queue Design

### New Queue Stages
- `research-collect-facts`
- `research-prepare-outreach`
- `research-send-outreach`
- `research-ingest-reply`
- `research-normalize-reply`
- `research-score-listings`
- `research-generate-report`

### Responsibilities

#### API
- Create runs.
- Persist approvals and user edits.
- Serve run state to the UI.
- Accept webhook traffic.

#### Crawler Or New Agent Worker
- Gather listing facts from variants and snapshots.
- Draft questions and messages.
- Parse inbound broker replies.
- Normalize facts.
- Score listings.
- Generate recommendation report.

Note:
- The existing crawler can host the background jobs in v1 because BullMQ is already in place.
- If the agent logic grows quickly, split into a dedicated `apps/agent` worker later.

## Recommendation Logic

### Inputs
- Existing listing cluster data.
- Variant-level facts.
- Fraud and trust labels.
- Broker-provided answers.
- User buy-box weights.

### Scoring Dimensions
- `fit`: how well the listing matches explicit user criteria.
- `value`: price and attribute competitiveness relative to shortlist peers.
- `risk`: fraud signals, missing data, inconsistent broker answers, stale inventory.
- `liquidity_or_readiness`: handoff timeline, finishing, delivery certainty, legal clarity.

### Output Requirements
- Always produce:
  - weighted scores
  - a short explanation per listing
  - a list of unresolved unknowns
- Never produce only a single opaque score.

### Ranking Rules
- If critical fields are missing, cap recommendation to `needs_info`.
- If a listing has a high-risk fraud label, it cannot be `best_overall` unless a user explicitly overrides.
- If no listing passes a minimum confidence threshold, return `No recommendation yet`.

## WhatsApp Integration Notes
- Treat WhatsApp as a provider-backed messaging channel, not a direct screen scrape.
- Store provider identifiers and webhook payloads for audit.
- Support two send modes in v1:
  - `copy_to_whatsapp`: user manually sends the drafted message
  - `provider_send_after_approval`: system sends after explicit approval
- Keep a provider abstraction:
  - `sendMessage`
  - `parseInbound`
  - `parseStatus`

This avoids locking the product to a single provider too early.

## Suggested Module Layout

### API
- `apps/api/src/buyer-profiles`
- `apps/api/src/research-runs`
- `apps/api/src/broker-threads`
- `apps/api/src/integrations/whatsapp`

### Shared Types
- Add new public types to `packages/types/src/index.ts`:
  - `BuyerProfileRecord`
  - `ResearchRunRecord`
  - `ResearchListingRecord`
  - `ResearchFactRecord`
  - `BrokerThreadRecord`
  - `BrokerMessageRecord`
  - `RecommendationReportRecord`

### Web
- `apps/web/src/app/[locale]/(app)/research/[id]/page.tsx`
- `apps/web/src/components/research-setup-form.tsx`
- `apps/web/src/components/research-run-status.tsx`
- `apps/web/src/components/research-compare-table.tsx`
- `apps/web/src/components/outreach-approval-form.tsx`
- `apps/web/src/components/recommendation-report.tsx`

## Rollout Plan

### Phase 7A: Compare Without Messaging
- Add buyer profile and research run models.
- Let users run AI analysis on shortlist items using existing listing data only.
- Produce a compare table, missing fields list, and provisional ranking.

Success criteria:
- Users can evaluate 3 to 10 properties in one view.
- Recommendations cite only listing and variant data.

### Phase 7B: Outreach Drafting
- Generate broker question sets and WhatsApp drafts.
- Add approval UI.
- Support `copy_to_whatsapp` first if provider integration is not ready.

Success criteria:
- Users can review and edit outbound messages per broker.

### Phase 7C: Provider Send And Reply Ingestion
- Add webhook-backed message delivery and inbound reply capture.
- Normalize broker answers into facts.
- Re-run ranking when new evidence arrives.

Success criteria:
- Broker replies update the compare view automatically.
- Recommendation report refreshes without manual rebuilds.

### Phase 7D: Ops And Quality Hardening
- Add admin review for suspicious messaging behavior.
- Add rate limits, retry rules, confidence thresholds, and better reporting.
- Track recommendation quality and user feedback.

## Admin And Observability
- Add an admin research queue for failed runs and webhook errors.
- Log per-stage latency and token usage if an LLM is used.
- Track:
  - run completion rate
  - average time to first broker reply
  - percentage of listings with sufficient data
  - recommendation click-through to source
  - user feedback on recommendation quality

## Metrics Of Success
- Median time from shortlist creation to recommendation.
- Number of manual steps removed from the buyer workflow.
- Percentage of runs that result in a clear top recommendation.
- Reply rate from brokers.
- User-reported usefulness score.

## Open Questions
- Should research runs be collaborative for all shortlist members or only the creator?
- Should the assistant message multiple brokers per listing or stop at the best detected contact?
- Do we allow Arabic and English message drafting from day one?
- Do we treat broker responses as private to shortlist members only?
- Do we let users override the ranking weights after the first report is generated?

## Recommended Build Order
1. Add research models and types.
2. Add shortlist-to-research API endpoints.
3. Build a read-only compare and recommendation flow from existing listing data.
4. Add message draft generation and approval UI.
5. Add provider-backed messaging and webhook ingestion.
6. Add report refresh, admin tooling, and limits.

## Recommendation
- Build this feature.
- Start as an `AI shortlist analyst` with optional broker outreach, not as an invisible fully autonomous agent.
- Make the compare table and evidence trail the center of the experience.
- Treat WhatsApp automation as a controlled integration with approvals and audit logs.
