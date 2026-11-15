# Test host notes (Railway)

A throwaway host for trying the app against the real server. Not production: production is the OVH VPS (see `runbook.md`).

- **Project:** `souschef-test` on Railway. Services: `souschef-api` (this repo's `server/`, built from `server/Dockerfile`, last stage `railway`), `Postgres`, `Redis` (not used by the server yet).
- **Address:** https://souschef-api-production.up.railway.app (`/healthz`, `/readyz`).
- **Deployed from the terminal, not from git:** from the repository root, `railway up --service souschef-api --detach` (uploads `server/` and `shared/`, see `.railwayignore`). Logs: `railway logs --service souschef-api`.
- **Starter content:** `railway ssh --service souschef-api -- npm run seed -- --admin you@example.com` (register in the app first for `--admin`).

## Settings on the host (names only; values live in Railway, never in git)

| Name | What it is |
|---|---|
| `DATABASE_URL`, `REDIS_URL` | References to the Postgres and Redis services |
| `JWT_SECRET`, `HEALTH_DATA_KEY` | Generated for this host (login tokens; health data encryption) |
| `NODE_ENV`, `TRUST_PROXY`, `RAILWAY_DOCKERFILE_PATH` | Production mode, trust Railway's proxy, which Dockerfile to build |
| `AI_GEMINI_API_KEY`, `AI_GEMINI_MODEL` | Gemini (photos, scaling, video). `AI_GEMINI_FREE_KEYS` can add free keys (see runbook, "Gemini key pool") |
| `AI_DEEPSEEK_API_KEY`, `AI_DEEPSEEK_MODEL` | DeepSeek (cheap text work) |
| `AI_NEBIUS_API_KEY`, `AI_NEBIUS_BASE_URL` | Nebius; stays off until `AI_NEBIUS_MODEL` is set |
| `AI_MONTHLY_BUDGET_USD` | Hard monthly stop on AI spend (2 on this host) |
| `FIREBASE_PROJECT_ID` | Turns on Firebase sign-in (`souschef-c23d6`): the app signs in with Firebase and the server trades the token |
| `TAVILY_API_KEY`, `FIRECRAWL_API_KEY` | Stored for later; the server does not use them yet |

Not set on purpose: the `S3_*` file-store settings (no bucket yet, so photo uploads and pantry/plate/caption photo features do not work here), `GOOGLE_CLIENT_IDS` / `APPLE_CLIENT_IDS` (server-side Google/Apple sign-in), `REVENUECAT_WEBHOOK_SECRET`, `EXPO_ACCESS_TOKEN`.

## Firebase stays for now

Nothing in Firebase was changed or removed. The app talks to this server only when `EXPO_PUBLIC_API_URL` is set; without it the app keeps using Firebase (auth and data) exactly as before. With it set, the app signs in against this server's own accounts, so existing Firebase accounts do not carry over (passwords cannot be exported): people register again, or Google/Apple sign-in is turned on here by setting the client IDs above. The Firebase bridge fixes that: set `EXPO_PUBLIC_AUTH_VIA=firebase` in the app and `FIREBASE_PROJECT_ID` on the host, and people keep signing in with their Firebase accounts (see `runbook.md`, "Signing in with Firebase").

## Things to know

- Registration here is open and the AI budget is small; take the host down or rotate keys when finished testing.
- Keys that were pasted into chat should be rotated before production.
- Recipe photos are Unsplash links.
