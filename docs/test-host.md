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
| `AI_NEBIUS_API_KEY`, `AI_NEBIUS_*` | Nebius Token Factory: text model, two vision models (photo jobs until Gemini is funded), optional dedicated endpoint (see "Nebius endpoints") |
| `AI_MONTHLY_BUDGET_USD` | Hard monthly stop on AI spend (2 on this host) |
| `FIREBASE_PROJECT_ID` | Turns on Firebase sign-in (`souschef-c23d6`): the app signs in with Firebase and the server trades the token |
| `TAVILY_API_KEY`, `FIRECRAWL_API_KEY` | Stored for later; the server does not use them yet |

Not set on purpose: the `S3_*` file-store settings (no bucket yet, so photo uploads and pantry/plate/caption photo features do not work here), `GOOGLE_CLIENT_IDS` / `APPLE_CLIENT_IDS` (server-side Google/Apple sign-in), `REVENUECAT_WEBHOOK_SECRET`, `EXPO_ACCESS_TOKEN`.

## Nebius: per token only

- The server uses Nebius's shared endpoints only, billed per token (no GPUs, no per-minute charge): base URL `https://api.tokenfactory.nebius.com/v1`, the model is the routing key (text: `Qwen/Qwen3-30B-A3B-Instruct-2507`; photos: `MiniMaxAI/MiniMax-M3.1-Flash`, about $0.15 in / $0.60 out per million tokens, and `deepseek-ai/DeepSeek-V4.1-Flash-1017`). The Token Factory catalog has text, vision and embedding models only: no speech or voice models, so voice is on-device recognition and speech.
- Spend is bounded by `AI_MONTHLY_BUDGET_USD` (estimated from token counts) and each person's daily limits.
- Dedicated endpoints (own GPUs, billed per minute) are not used and not deployed. The settings for one (`AI_NEBIUS_DEDICATED_*`) stay in the code, empty and off; leave them empty.

## Link imports (YouTube, TikTok, Instagram)

The API image carries `yt-dlp` (`YT_DLP_PATH`), which reads a video's caption and subtitles without downloading the video. The text goes to the text model. TikTok falls back to the page's own data and Instagram to its public embed caption. If a platform blocks the host's address, set `IMPORT_PROXY_URL`. When a caption holds no recipe the app asks the person for up to 6 screenshots of the video and the server reads those (Nebius vision). `server/scripts/probe-imports.mjs` checks real links against the live host; with the Agent Reach tool installed it can also print Agent Reach's own reading of each link for comparison.

## Web build and CORS

The app's web build calls the API from another origin: set `CORS_ORIGINS` (comma-separated exact origins, e.g. `http://localhost:8081`). Empty means no CORS. The staff dashboard is served by the API at `/admin/` and needs none.

## Firebase stays for now

Nothing in Firebase was changed or removed. The app talks to this server only when `EXPO_PUBLIC_API_URL` is set; without it the app keeps using Firebase (auth and data) exactly as before. With it set, the app signs in against this server's own accounts, so existing Firebase accounts do not carry over (passwords cannot be exported): people register again, or Google/Apple sign-in is turned on here by setting the client IDs above. The Firebase bridge fixes that: set `EXPO_PUBLIC_AUTH_VIA=firebase` in the app and `FIREBASE_PROJECT_ID` on the host, and people keep signing in with their Firebase accounts (see `runbook.md`, "Signing in with Firebase").

## Things to know

- Registration here is open and the AI budget is small; take the host down or rotate keys when finished testing.
- Keys that were pasted into chat should be rotated before production.
- Recipe photos are Unsplash links.
