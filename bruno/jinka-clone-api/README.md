# Jinka Clone Bruno Collection

This Bruno collection covers every HTTP API route currently implemented in this repository:

- Direct NestJS backend routes under `/v1/*`
- Next.js proxy routes under `/api/*`

## Local setup

1. Start the stack, for example with `pnpm dev:all`.
2. Open `/Users/mohamedkhairy/dev/jinka-clone/bruno/jinka-clone-api` as a Bruno collection.
3. Select the `local` environment.
4. Run the direct auth flow first:
   - `Direct API / 01 Auth Request OTP`
   - `Direct API / 02 Auth Verify OTP`

The default `userEmail` is `demo@example.com`, which becomes an admin user in local development. That lets you exercise the admin endpoints after OTP verification.

## Variable workflow

- `01 Auth Request OTP` captures `otpCode` from the backend's non-production `otpPreview`.
- `02 Auth Verify OTP` captures `accessToken`, `refreshToken`, and `userId`.
- Public list endpoints capture IDs when possible:
  - `GET /v1/areas` captures `areaId`
  - `GET /v1/listings` captures `clusterId`
  - `GET /v1/projects` captures `projectId`
- Create endpoints capture resource IDs when possible:
  - alerts -> `alertId`
  - favorites -> `favoriteId`
  - reports -> `reportId`
  - shortlists -> `shortlistId`
- Admin list endpoints capture IDs when possible:
  - reports -> `reportId`
  - fraud cases -> `fraudCaseId`
  - parser drift alarms -> `parserDriftAlarmId`

Some admin mutations still need manual values:

- `targetClusterId` for cluster merge
- `variantId` for cluster split
- `googleCallbackCode` and `googleCallbackState` for direct OAuth callback testing

## Auth model

- Direct `/v1/*` protected endpoints use `Authorization: Bearer {{accessToken}}`.
- Next `/api/*` protected proxy endpoints use a `Cookie` header with `access_token` and `refresh_token`.
