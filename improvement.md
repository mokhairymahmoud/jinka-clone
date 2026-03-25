# Improvement Plan

This document turns the current project review into an implementation-ready backlog.

## Validation Snapshot

- `pnpm lint` passes
- `pnpm typecheck` passes
- `pnpm test` passes
- Current gaps are mostly in auth hardening, operational safety, and implementation depth rather than compile-time correctness

## Delivery Order

1. Fix auth and security issues
2. Tighten engineering workflow and validation
3. Expand product capabilities

## Priority 1: Critical Fixes

### 1. Fix expired-session redirect loops

Status: Completed

#### Problem

The web app currently treats the presence of an `access_token` cookie as authenticated state, even if the token is expired. Protected pages then fail server-side auth checks and redirect back to sign-in, while middleware can immediately bounce the user away from sign-in because the stale cookie still exists.

#### Affected files

- `apps/web/middleware.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/app/[locale]/(app)/layout.tsx`
- `apps/web/src/app/[locale]/sign-in/page.tsx`
- Likely new route or utility for refresh handling

#### Implementation plan

- Replace cookie-presence checks in middleware with one of these patterns:
  - Preferred: only use middleware for locale handling and let server auth decide access
  - Alternative: validate or refresh the session in middleware before redirecting
- Introduce a server-side refresh flow using `refresh_token`
- When `/v1/me` returns `401`, clear stale cookies before redirecting
- Ensure the sign-in page does not redirect authenticated users unless the session is actually valid

#### Acceptance criteria

- Expired `access_token` does not cause redirect loops
- A user with a valid `refresh_token` is re-authenticated transparently
- A user with no valid session lands on sign-in cleanly
- Sign-in page remains accessible when cookies are stale

#### Tests

- Add an integration test for expired `access_token` plus valid `refresh_token`
- Add a test for expired `access_token` plus missing `refresh_token`
- Add a regression test for sign-in route behavior with stale cookies

### 2. Harden OTP authentication

Status: Completed

Implemented in current slice:

- Add per-email and per-IP OTP request throttling
- Add per-email and per-IP OTP verification throttling
- Enforce max-attempt lockout on the active `OtpChallenge`
- Mark locked challenges with `blockedAt` and stop them from being reused
- Invalidate older active challenges when issuing a new OTP
- Record request and verification IP metadata on OTP challenges
- Emit abuse warnings when throttles or challenge lockouts trigger

#### Problem

OTP challenges are generated and failed attempts are counted, but the system does not enforce a maximum number of attempts or rate-limit requests. That leaves the latest active OTP vulnerable to brute-force attempts.

#### Affected files

- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/prisma/schema.prisma`
- Possibly Redis-backed helpers in `apps/api/src/common`

#### Implementation plan

- Add per-email and per-IP throttling to:
  - `POST /v1/auth/email/request-otp`
  - `POST /v1/auth/email/verify-otp`
- Enforce a maximum attempt count on `OtpChallenge`
- Mark a challenge as blocked or consumed after too many failures
- Invalidate or supersede older challenges when a new one is created
- Add audit logging for abuse signals
- Consider using Redis for short-window counters

#### Acceptance criteria

- Repeated OTP requests are throttled
- Repeated OTP verification failures lock the active challenge
- A locked challenge cannot be brute-forced further
- Abuse events are observable in logs and metrics

#### Tests

- Add tests for max-attempt lockout
- Add tests for throttled request behavior
- Add tests proving old OTP challenges cannot be reused

### 3. Stop exposing tokens to client-side JavaScript

Status: Completed

#### Problem

The system sets auth cookies as `httpOnly`, but still returns `accessToken` and `refreshToken` in JSON responses. That makes the tokens readable by client-side JavaScript and weakens the main security value of cookie-based auth.

#### Affected files

- `apps/api/src/auth/auth.controller.ts`
- `apps/web/src/app/api/auth/verify-otp/route.ts`
- `apps/web/src/components/sign-in-form.tsx`
- Any refresh route added during session work

#### Implementation plan

- Change API auth responses to return:
  - user/session metadata
  - success flags
  - redirect target if needed
- Do not return raw access or refresh tokens in JSON
- Keep token issuance and cookie setting entirely server-side
- Review any client component assumptions that parse auth payloads

#### Acceptance criteria

- Browser JS cannot read raw auth tokens from OTP or refresh responses
- Auth still succeeds through cookie-based session state
- Frontend flows continue to work without token payload access

#### Tests

- Add tests that assert auth responses exclude `accessToken` and `refreshToken`
- Add a client flow regression test for OTP sign-in

### 4. Enforce environment validation outside development

#### Problem

The shared schema defines required secrets, but the API currently relaxes that schema and falls back to predictable default JWT secrets. Misconfigured environments can boot successfully in an insecure state.

#### Affected files

- `packages/config/src/index.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/auth/jwt-auth.guard.ts`
- `apps/api/src/auth/auth.service.ts`

#### Implementation plan

- Remove `sharedEnvSchema.partial()` from non-development boot paths
- Fail fast when required secrets are missing
- Gate local defaults behind an explicit development-only branch
- Centralize env access so secrets are not scattered across services and guards

#### Acceptance criteria

- Production-like boot fails when JWT secrets are missing
- Development remains easy to run locally
- JWT secret resolution is consistent across issue, refresh, and verify paths

#### Tests

- Add startup tests for missing env vars
- Add unit tests for env resolution helpers if introduced

## Priority 2: Engineering Improvements

### 5. Add real linting

#### Problem

The repo's `lint` commands currently behave like TypeScript checks, not linting. This leaves style, unused code, import hygiene, and framework-specific issues under-validated.

#### Affected files

- `package.json`
- `apps/web/package.json`
- `apps/api/package.json`
- `apps/crawler/package.json`
- New ESLint config files where needed

#### Implementation plan

- Introduce actual ESLint commands per workspace
- Keep `typecheck` separate from `lint`
- Enable Next.js and TypeScript rules in `web`
- Add NestJS and general TypeScript rules in `api` and `crawler`
- Wire lint into Turbo consistently

#### Acceptance criteria

- `pnpm lint` runs ESLint, not just `tsc`
- `pnpm typecheck` remains focused on type safety
- CI can fail on lint issues independently

### 6. Expand test coverage around auth and session flows

#### Problem

Current tests pass, but the highest-risk flows are lightly covered. Auth, cookie lifecycle, refresh, and abuse scenarios need stronger protection.

#### Implementation plan

- Add API tests for auth service and controller behavior
- Add web tests for sign-in, stale cookies, and protected route behavior
- Add regression coverage for refresh and logout flows

#### Acceptance criteria

- Auth regressions are caught by automated tests
- Session refresh behavior is covered
- Stale-cookie bugs are reproducible in tests

### 7. Tighten DTO and payload validation

#### Problem

Several controllers accept broad string or array payloads where enums and item validation would be safer. This increases the chance of malformed or inconsistent data entering the system.

#### Affected areas

- alerts
- favorites
- shortlists
- admin
- users

#### Implementation plan

- Replace loose string fields with enums where possible
- Use array element validators for `string[]` payloads
- Validate nested objects explicitly
- Normalize user input at the edge

#### Acceptance criteria

- Invalid payload shapes are rejected consistently
- Shared public types and DTOs stay aligned

### 8. Clean repo build artifacts and Turbo warnings

#### Problem

Generated `tsbuildinfo` files are tracked in the repo and Turbo reports warnings about missing test outputs.

#### Affected files

- `apps/api/tsconfig.tsbuildinfo`
- `apps/web/tsconfig.tsbuildinfo`
- `.gitignore`
- `turbo.json`

#### Implementation plan

- Remove tracked build artifacts from version control
- Add them to `.gitignore`
- Either configure test coverage outputs properly or remove misleading Turbo `outputs` settings for test tasks

#### Acceptance criteria

- Build cache artifacts are no longer committed
- Turbo runs without avoidable test-output warnings

## Priority 3: Product Features

### 9. Session and device management

Status: Completed

Implemented in current slice:

- Add an active session list under account settings
- Mark the current device session explicitly
- Show last active time, sign-in time, expiry time, IP, and device/browser summary
- Revoke a specific non-current session
- Revoke all other sessions in one action
- Record session refresh activity timestamps on `AuthSession`

#### Why

Once auth is hardened, users need visibility and control over their active sessions.

#### Scope

- Active sessions list
- Revoke other sessions
- Last active time
- Device or browser fingerprint summary

#### Suggested backend work

- Expand `AuthSession` usage
- Add endpoints for listing and revoking sessions
- Record refresh activity timestamps

#### Suggested frontend work

- Add a session management panel under account settings

### 10. Better alert controls

Status: Completed

Implemented in current slice:

- Pause or resume an alert
- Snooze an alert for 24 hours or 7 days
- Choose immediate, daily digest, or weekly digest delivery cadence
- Set minimum price-drop percentage and amount thresholds per alert
- Edit per-alert push and email delivery settings
- Edit quiet hours from the alert UI
- Track and display the last matched time for each alert
- Show recent per-alert activity history with delivery statuses

#### Why

Alerts are central to the product, but current controls are still basic.

#### Scope

- Pause or snooze alert
- Digest cadence options
- Price-drop thresholds
- Alert activity history
- Per-alert notification channels

#### Suggested backend work

- Extend `Alert` model and delivery logic
- Add notification scheduling preferences

#### Suggested frontend work

- Expand alert forms and alert detail pages
- Show last matched listing time and delivery status

### 11. Stronger search workflow

#### Why

Search is functional, but users need better decision support once they have results.

#### Scope

- Listing compare mode
- Saved filter presets
- Draw-on-map search
- Commute or landmark filters
- Price history and market context

#### Suggested backend work

- Extend search filters and search documents
- Store compare or saved-search presets

#### Suggested frontend work

- Add compare tray
- Add map interaction tools
- Add richer listing summary panels

### 12. Better shortlist collaboration

#### Why

Shortlists already exist, but collaboration is still lightweight.

#### Scope

- Invitation acceptance flow
- Real member permissions
- Activity timeline
- Listing-specific discussion threads

#### Suggested backend work

- Enforce shortlist role permissions
- Add invitation tokens or pending invites
- Add activity events

#### Suggested frontend work

- Member management UI
- Activity feed in shortlist view
- Clear owner/editor/viewer affordances

### 13. Trust and moderation workflow

#### Why

Reports, fraud review, and ops tooling are already present; the next step is clearer user feedback and better moderation structure.

#### Scope

- Structured report categories
- Report status lifecycle
- User-visible report outcomes
- Admin SLA or aging indicators

#### Suggested backend work

- Extend `Report` with category and status
- Track moderation timestamps and ownership

#### Suggested frontend work

- Show report status in user account or listing context
- Improve admin review prioritization

## Suggested Milestones

### Milestone A: Security and session correctness

- Fix stale-cookie loop
- Implement refresh flow
- Stop returning tokens in JSON
- Enforce OTP throttling and lockout
- Enforce env validation

### Milestone B: Engineering baseline

- Add real ESLint
- Expand auth/session tests
- Tighten DTO validation
- Clean build artifacts and Turbo warnings

### Milestone C: Product expansion

- Session management UI
- Advanced alerts
- Compare mode and saved searches
- Rich shortlist collaboration
- Improved moderation UX

## Recommended First Tickets

1. Completed: Implement server-side refresh and stale-cookie recovery
2. Completed: Remove token fields from auth JSON responses
3. Add OTP rate limiting and max-attempt enforcement
4. Fail boot when JWT secrets are missing outside development
5. Add auth integration tests covering the above
