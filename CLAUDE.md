# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

YouTOP backend — a NestJS 11 API for an edtech/e-commerce store (courses, ebooks, notes, scholarships). It stitches together three external systems: **Strapi** (headless CMS = product/content catalog), **Postgres** (users, orders, webhook audit log), and **Clerk** (auth). Payments run through **Razorpay**. Redis backs both caching and BullMQ job queues.

## Commands

```bash
npm run start:dev        # dev server, watch mode (port 3001)
npm run build            # nest build -> dist/
npm run start:prod       # node dist/main
npm run lint             # eslint --fix (auto-fixes in place)
npm run format           # prettier --write

npm test                 # jest, all *.spec.ts under src/
npm test -- courses      # run a single suite by filename pattern
npm run test:watch
npm run test:e2e         # uses test/jest-e2e.json

# DB (sequelize-cli; config in database/config.cjs)
npm run migrate:up       # apply migrations
npm run migrate:down     # undo last
npm run migrate:create -- <name>   # scaffold a migration
npm run seed:run
```

There is no `.env.example`; required keys (read from `.env`): `DATABASE_URL`, `REDIS_URL` (or `REDIS_HOST`/`REDIS_PORT`), `STRAPI_URL`, `STRAPI_API_TOKEN`, `CDN_URL`, `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, `CLERK_WEBHOOK_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `FRONTEND_URL`, `PORT`, `NODE_ENV`. Optional: `PLACEHOLDER_IMAGE_URL` (fallback image for products/content with no Strapi thumbnail; defaults to an inline SVG data URI — see `MediaUrlHelper.image()`). Scraper (all optional): `SCRAPE_SCHEDULE_ENABLED` (`true` to run the recurring scrape; default off), `SCRAPE_INTERVAL_MS` (default 6h), `SCRAPER_MAX_ITEMS` (per-source cap per run, default 25), `SCRAPER_DELAY_MS` (politeness delay between sources, default 1500), `SCRAPER_USER_AGENT`. Official open-data source (`data.gov.in — NCS Jobs`, in `sources.registry.ts`): `DATA_GOV_API_KEY` + `DATA_GOV_NCS_RESOURCE_ID` — when both are set the scraper fills the `{API_KEY}`/`{RESOURCE_ID}` placeholders and pulls live NCS job vacancies into **Job News** (category `job`); when unset that one source is skipped (RSS/HTML sources still run). Record field names vary per data.gov.in resource — override via the source's `apiFields` (e.g. `{ title: 'jobtitle', date: 'postedon' }`); see `data-gov.mapper.ts` for the default alias probing. Aggregator pipeline (official per-source scrapers): `SCRAPE_SOURCE_INTERVAL_MS` (per-source repeatable interval when the scheduler is on; default 30m). AI-SEO enrichment (all optional, off by default): `AI_ENRICH_ENABLED` (`true` to enrich scraped notices), `ANTHROPIC_API_KEY`, `AI_ENRICH_MODEL` (default `claude-haiku-4-5`) — when on, `AiEnrichmentService` fills `seo_description`/`seo_keywords`/excerpt via Claude without rewriting scraped facts.

## Request/response conventions (apply to every controller)

- **Global prefix + versioning**: all routes live under `/api/v1/...` (`setGlobalPrefix('api')` + URI versioning, `defaultVersion: '1'`). New controllers use `@Controller({ path: 'x', version: '1' })`.
- **Controllers return raw data.** `ResponseTransformInterceptor` (global) wraps every success into `{ success, data, timestamp, path }`. `GlobalExceptionFilter` (global) wraps every error into `{ success: false, statusCode, message, timestamp, path }` — throw `HttpException` subclasses, don't hand-build error responses.
- **Validation** is global: `ValidationPipe({ whitelist: true, transform: true })`. Put DTOs with `class-validator` decorators on `@Body()`.
- Two Bull Board / infra routes are NOT under the API prefix logic in the usual sense: `/queues` (BullMQ dashboard).

## Auth flow (Clerk)

- Two guards in `src/auth/`: `ClerkAuthGuard` (required — 401 if no valid token) and `ClerkOptionalAuthGuard` (never blocks; enriches request if a token is present). Public catalog endpoints use the optional guard so `isOwned` can be computed for signed-in users.
- Token is read from the `__session` cookie **or** `Authorization: Bearer`. Verification prefers offline RSA via `CLERK_JWT_KEY`, falling back to a Clerk API call with `CLERK_SECRET_KEY`.
- On success the guard sets `request.userId` (Clerk `sub`) and `request.user` (the Postgres row). Read the id in handlers via the `@UserId()` decorator.
- **User rows are synced three independent ways** — keep all three consistent when changing the User shape: (1) frontend `POST /users/sync`, (2) Clerk webhooks (async, see below), (3) `UsersService.findOrSyncFromClerk` — a sync-on-demand fallback the guard runs when a `clerkId` is missing from the DB (webhook was dropped). That method also migrates an existing row to a new `clerkId` on email collision (e.g. Google re-auth).
- Role gating: `RolesGuard` + `@Roles(...)`, reads `request.user.role`. Must run after a Clerk guard.

## Two data sources, joined in service layer

Module services (`src/modules/*`) are the seam between Strapi and Postgres. The recurring pattern (see `courses.service.ts`): fetch the catalog from Strapi, fetch the user's successful `Order` rows from Postgres via `RazorpayService.getUserPurchases`, then set `isOwned` by matching `Order.productId` against the Strapi product id. Ownership = a paid Razorpay order, never a Strapi field.

### StrapiService (`src/core/strapi/`)
- Thin REST client over `fetch`. `getCollection` / `getSingle` take a raw Strapi query path (filters/populate) and a TTL.
- `flatten()` collapses Strapi v5's nested `{ data: { attributes } }` envelope into plain objects — expect flattened shapes downstream, not raw Strapi responses.
- **Caching is Redis-backed and bypassed entirely when `NODE_ENV !== 'production'`** (dev always hits Strapi live). Keys are `strapi:collection:*` / `strapi:single:*`.
- Cold-start hardening for Render free tier: `warmUp()` pings on boot, and `fetchRaw` retries timeouts with backoff (3 attempts).

### PostgresService (`src/core/database/`)
- `@Global` provider. **Lazy singleton** connection — every DB method calls `getConnection()` first (connection is not opened at boot). Sequelize is created with `ALL_MODELS`.
- Exposes both an ORM surface (`.models.User`, `.models.Order`, `.models.WebhookEvent`) and raw SQL helpers (`query`, `select`, `execute`, `transaction`).
- Models are `sequelize-typescript` classes in `src/models/`, registered in `models.registry.ts`. **Schema is migration-managed (`database/migrations/`), not auto-synced** — adding a model means: create the class, add it to both `ALL_MODELS` and `Models` in `models.registry.ts`, and write a migration.

## Async webhooks + queues (BullMQ)

`WebhooksController`:
- `POST /webhooks/clerk` — verifies the svix signature (needs the **raw** body; app is bootstrapped with `rawBody: true` and handlers use `@RawBody()`), dedupes via the `WebhookEvent` table, writes an audit row, pushes a job to the Clerk queue, and returns `200` immediately. Actual user upsert happens in `clerk-webhook.consumer.ts`, which marks the row `processed` on success and records `errorMessage` on final retry failure.
- `POST /webhooks/strapi` — Strapi change hook; clears the CMS cache via `cacheService.delPattern('strapi:*')`.

Queues live in `src/queues/` (`clerk-webhooks`, `email`, `analytics`), configured in `queues.module.ts`. Redis connection mirrors `CacheService`'s config (URL or host/port). Inspect jobs at `/queues` (Bull Board).

## Conventions

- **Filenames and folders under `src/` must be kebab-case** — enforced by `eslint-plugin-check-file`, so a lint run will fail on `myService.ts`.
- Many `@typescript-eslint` strictness rules (`no-explicit-any`, the `no-unsafe-*` family) are intentionally disabled — `any` is used freely for Strapi's dynamic shapes.
- Config is registered as namespaces (`appConfig`/`strapiConfig`/`redisConfig` via `registerAs`), but most code reads flat keys directly with `configService.get('STRAPI_URL')`. Both work.
- Media/image URLs from Strapi go through `MediaUrlHelper` (prefixes relative paths with `CDN_URL` or `STRAPI_URL`; passes absolute/data URLs through). It's a static class initialized once in `main.ts`. Use `.image()` for any field rendered as an `<img>`/`next/image` — it never returns an empty string (falls back to `PLACEHOLDER_IMAGE_URL` / a default SVG), which is what keeps `next/image` from throwing on a missing thumbnail. `.resolve()` may return `''` and is for non-image or self-guarded uses.
