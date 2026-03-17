# Final Product Architecture

## Architecture statement

Build the full product as a modular-monolith core platform around PostgreSQL + PostGIS, with independently scalable ingestion, canonicalization, workflow, search-indexing, and AI research workers, all inside one monorepo and all feeding one bilingual consumer experience plus admin operations surfaces.

## Final target shape

### Experience layer

- Web PWA remains the primary consumer experience.
- Native iOS and Android clients can be added later against the same API surface.
- Admin and ops stay in the same frontend codebase, separated by route space and authorization.

### Core product platform

Single request-serving backend with clear bounded contexts:

- identity and sessions
- user profiles and preferences
- alerts and saved searches
- favorites and shortlists
- notifications read APIs
- reports and admin actions
- catalog read APIs for listings, projects, areas, and developers

This stays a modular monolith until team shape or scale truly forces extraction.

### Ingestion and canonicalization platform

Separate worker runtime responsible for:

- source registry and schedules
- quotas and retry policies
- connector health and parser version tracking
- raw fetch persistence
- parsing and normalization
- source listing persistence
- duplicate candidate generation
- duplicate scoring and merge or split decisions
- canonical listing updates

This is the main independently scalable data platform in the system.

### Workflow platform

Separate worker processes for non-request work:

- search indexing
- alert matching
- notification policy evaluation
- delivery fanout
- backfills and replay jobs

### AI research platform

Separate worker domain for the buyer assistant:

- research runs
- fact extraction
- approval-gated broker outreach
- reply parsing
- recommendation generation

This is a product domain, not just a feature hanging off shortlists.

## Data ownership

### Application database: PostgreSQL + PostGIS

Owns:

- users, sessions, profiles, preferences
- favorites, shortlists, comments, reports
- alerts and saved-search definitions
- areas, developers, projects
- canonical listings
- canonical listing memberships
- source listings metadata
- price and status history
- alert matches
- notification candidates and delivery logs
- moderation and audit state
- AI research state

This is the system of record.

### Object storage

Owns immutable or heavy artifacts:

- raw HTML snapshots
- API payloads
- screenshots
- parser debug artifacts
- evidence attachments
- exported reports

This is the replay foundation.

### Redis

Owns operational coordination:

- queues
- rate limits
- distributed locks
- short-lived caches
- webhook dedup windows

### Dedicated search index

Owns derived search read models only:

- listing search documents
- project search documents
- area and developer suggestions

This is always rebuildable from canonical state.

## Bounded contexts

### Identity and accounts

Owns auth, sessions, roles, locale, and notification preferences.

### Catalog and discovery

Owns canonical listings, projects, developers, areas, and query-facing read models.

### Ingestion and source operations

Owns connectors, crawl schedules, raw artifacts, parser versions, source listings, and replay.

### Dedup and canonicalization

Owns candidate generation, feature computation, decision history, membership lineage, and canonical listing mutations.

### Trust and moderation

Owns fraud labels, source blacklists, parser drift alarms, takedown flows, reports, and operator overrides.

### Alerts and communications

Owns saved-search evaluation, alert matches, notification policy, quiet hours, batching, and delivery outcomes.

### Collaboration

Owns favorites, shortlists, shortlist comments, shares, and compare workflows.

### AI buyer research

Owns buyer profiles, research runs, research facts, broker threads, broker messages, and recommendation reports.

## Event and reliability model

### Source of events

Only canonical listing changes emit downstream business events.

Examples:

- `canonical_listing_created`
- `canonical_listing_updated`
- `canonical_price_changed`
- `canonical_status_changed`
- `dedup_merge_applied`
- `dedup_split_applied`

Scraper-stage events are operational only. They do not drive user-facing alerts.

### Delivery pattern

Use a transactional outbox in PostgreSQL for downstream jobs and events.

Each canonical change writes:

- the canonical row change
- the lineage update
- the outbox record

in the same database transaction.

Workers then publish or consume from the outbox safely.

### Idempotency rules

- every event has a deterministic idempotency key
- alert matches are unique on `user_id + saved_search_id + canonical_listing_id + change_type + listing_version`
- notification candidates are unique on `user_id + channel + template + dedup_window`
- provider delivery attempts are logged separately from notification intent

## Canonical listing model

Canonical listings represent one real-world property opportunity.

Each canonical listing must preserve:

- current normalized state
- source membership list
- source-to-canonical lineage
- merge and split history
- price history
- status history
- trust and moderation state

This is the center of the product.

## Dedup pipeline

### Step 1: candidate generation

Use cheap, high-recall signals:

- source IDs and canonical URLs
- normalized phone hashes
- image hashes
- geo buckets and area hierarchy
- normalized compound or developer names
- beds, baths, area, and price bands

### Step 2: scoring

Apply rules plus ML on narrowed candidates:

- multilingual text similarity
- embedding similarity if needed
- historical merge evidence
- market-segment-specific weights

### Step 3: decisioning

Produce one of:

- auto-merge
- send to review
- keep separate
- split existing cluster

Decision history must be stored, not overwritten.

## Search architecture

### Search principle

Search is a derived read model, never the source of truth.

### Search serving

Use a dedicated search engine at full scale for:

- bilingual full-text search
- geo queries
- facets
- autosuggest
- ranking by freshness, trust, completeness, and relevance

### Reindexing

The system must support:

- single-listing reindex
- partition reindex
- full rebuild from canonical state

## Alert and notification architecture

### Alert matching

Alert evaluation happens on canonical listing events, not during crawling.

This keeps the system scalable as alert volume grows.

### Notification flow

1. listing event arrives
2. alert matcher computes affected saved searches
3. alert matches are persisted idempotently
4. notification policy decides push, email, digest, or suppress
5. delivery attempts are logged per provider

### Stores

Use separate storage concerns:

- `alert_match_store`: semantic match history
- `notification_candidate_store`: notification intent
- `notification_delivery_log`: provider attempts and outcomes

## Trust and moderation

Treat trust as a first-class subsystem, not as a side table.

It should own:

- fraud assessments
- review queues
- source blacklists
- takedown handling
- parser drift alarms
- operator overrides
- audit logs

This domain affects search ranking, alert eligibility, and user-facing trust labels.

## Geography and Egypt-specific data

Area and geospatial logic should be explicit infrastructure.

Own:

- Egypt area taxonomy
- bilingual area names
- hierarchy of city, district, compound, and neighborhood
- polygon geometry
- coordinate confidence
- map query helpers

This should feed both canonicalization and search.

## Replay and backfill

The platform must support full replay because source sites, parsers, and rules will change.

Required replay jobs:

- re-run parsers from raw artifacts
- recompute duplicate features and decisions
- rebuild canonical memberships
- rebuild search documents
- recompute alert matches if rules change

## Recommended deployables

### Near-term full product

- `apps/web`
- `apps/api`
- `apps/crawler`
- `apps/worker`
- `apps/research-worker`

### Why this is the right final target for now

- one repo and one primary data model keep iteration fast
- ingestion and workflows scale independently
- search and notifications remain derived systems
- architecture stays understandable for a small-to-medium engineering team

## What not to do yet

- do not split auth, favorites, or shortlists into separate services
- do not let the search engine become the source of truth
- do not trigger user alerts directly from crawlers
- do not let AI workflows bypass approval, audit, or evidence storage

## Final recommendation

Use a modular monolith for the product core, a separate ingestion and canonicalization platform for source data, a dedicated derived-search layer for discovery, an event-driven alert and notification workflow built on canonical listing changes, and a first-class trust plus lineage model so the aggregator remains debuggable and replayable as it scales.
