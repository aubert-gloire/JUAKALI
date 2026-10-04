# Architecture Decisions

## D-001: Monorepo layout — npm workspaces
Three workspaces: `server`, `web`, `scripts`. No turborepo or nx — keeps zero-config Vercel deploy straightforward and avoids extra tooling. If the project grows to multiple frontend apps, migrate to turborepo.

## D-002: Deployment region — Frankfurt (eu-west-1)
Vercel Hobby free tier closest to Rwanda: `fra1` (Frankfurt). Atlas M0 also configured to EU (Frankfurt / eu-west-1). Both in the same region to minimize latency. Verified: Vercel docs list `fra1` as a serverless function region; Atlas free tier supports `aws/eu-west-1`.

## D-003: TypeScript target — CommonJS output for server
`server/tsconfig.json` outputs CommonJS to avoid ESM compatibility issues with Express, Mongoose, and Vercel's esbuild bundler. Frontend uses ESM (handled by Vite).

## D-004: No `express-async-errors` package
Using a local `asyncHandler` wrapper (`src/utils/asyncHandler.ts`) instead, to keep the dependency count low and the error flow explicit.

## D-005: `bcryptjs` instead of `bcrypt`
`bcryptjs` is a pure-JS implementation — no native bindings to compile in Vercel's build environment. Cost: ~30% slower hashing (acceptable for auth routes).

## D-006: JWT in httpOnly cookies, not Authorization header
`access_token` and `refresh_token` stored in httpOnly, secure, sameSite=strict cookies. The frontend never touches the token string. CSRF risk is mitigated by sameSite=strict.

## D-007: Access token 15 min, refresh token 7 days
Standard secure defaults. The refresh token is rotated on every use (rotation implemented in auth service).

## D-008: Tenant scope via helper, not model override
`createTenantScope(tenant)` returns a `scope()` function that injects `shopId` and `organizationId` into every query object. Explicit — the developer must call it. Easier to test and grep for than monkey-patching Mongoose models.

## D-009: Entitlements service always-on, billing flag gates UI only
`EntitlementsService` is always instantiated. With `BILLING_ENABLED=false`, `can()` returns true for all features and `withinLimit()` returns true for all limits. No conditional import of billing logic anywhere outside the billing module itself.

## D-010: Gemini SDK package — `@google/generative-ai`
Used as of build start (October 2025). The spec requires verifying against current docs before use. If the package name has changed, update `server/package.json` and `server/src/ai/gemini.ts`.

## D-011: Refresh token rotation
On every successful refresh, the old refresh token is invalidated and a new one is issued. Rotation makes token theft detectable (reuse of an old refresh token invalidates the session).

## D-012: MongoDB queries use `.lean()` for reads
All read-only queries use `.lean()` to return plain JS objects, avoiding Mongoose document overhead. Write paths use full Mongoose documents for validation.

## D-013: Receipt numbers — per-shop atomic counter
`Counter` collection with `findOneAndUpdate` + `upsert` + `$inc` for atomic sequential receipt numbers per shop. Chosen over UUIDs for human-readable receipts.

## D-014: Money as integers in RWF
All monetary values stored as integers (RWF has no subunit in practice). No floats anywhere in the data layer. Frontend formats for display only.
