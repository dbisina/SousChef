# enplace server

The backend for the app: accounts and sign-in today, with recipes, chat, feed and the rest arriving phase by phase.
Node 22, TypeScript (strict), Fastify, PostgreSQL through Prisma, and a Rust addon for the heavy jobs.

## Run it

You need Docker (and nothing else: Node, Rust and PostgreSQL all run in containers).

```bash
docker compose up --build
```

The API is at <http://localhost:3000> (`/healthz`, `/readyz`, `/v1/...`) and PostgreSQL at `localhost:55432`.
The first build compiles the Rust crate and takes a few minutes; later builds reuse the cache.

```bash
docker compose run --rm server npm test        # all tests, against a real PostgreSQL (the souschef_test database)
docker compose run --rm server npm run typecheck
docker compose run --rm server npm run lint
```

Without Docker you need Node 22, the Rust toolchain, and a PostgreSQL you can point `DATABASE_URL` at
(copy `.env.example` to `.env`): `npm install`, `npm run native:build`, `npx prisma generate`, `npm run dev`.

## Layout

| Path | What |
|---|---|
| `src/app.ts` | builds the server; everything it needs is passed in, so tests can swap the database, clock and mailer |
| `src/config.ts` | reads and checks the environment once at startup |
| `src/auth/` | sign-up and sign-in, tokens, passwords, Google and Apple, password reset |
| `src/subscriptions/` | plans from RevenueCat's webhook, `GET /v1/me/entitlements`, and what each plan unlocks |
| `src/uploads/`, `src/storage/` | photo and voice uploads straight to the file store (R2) with a short-lived link; SigV4 signing written against the spec and checked against the AWS SDK |
| `src/chat/` | conversations, messages numbered 1, 2, 3 with safe resend, read and delivered ticks, reactions, replies, groups, blocking (live delivery: see the gateway) |
| `src/social/` | profiles, follows, people search, posts (recipe / made this / video / plan), comments with replies and voice notes, following and discover feeds |
| `src/social/stories.ts`, `reports.ts` | stories that disappear after 24 hours (tray, views, sweep), reporting, and the staff moderation queue |
| `src/communities/` | communities (public or private), joining and approval, roles, a chat room each, posts inside them, challenges and events |
| `native/feed/` | the "for you" ranker in Rust: engagement (a save counts most), freshness (half-life about 9 hours), a lift for authors you follow or liked, and no author filling the page. `GET /v1/feed/for-you` hands it the last week's posts |
| `src/invites/` | invite codes and the "10 friends" reward (a month of Pro for you and them, up to three times), and labeled official house accounts with a one-switch kill |
| `src/ai/` | the AI router: Gemini, DeepSeek and Nebius behind one interface, fallback between them, a hard monthly spending limit, per-person daily limits, and a record of every call. No AI key is ever in the app |
| `src/imports/` | importing a recipe from a link (YouTube, TikTok, Instagram or any recipe page): the page's own recipe data when it has it, otherwise the AI; a shared cache; frames from the phone when the caption has no recipe. Pages are fetched with strict protection against being tricked into reading internal addresses |
| `src/recipes/` | recipes: create/edit, filters, search, "cook with what I have", likes, saves, ratings, comments, "I made this", reports |
| `prisma/schema.prisma` | the database. Every change needs a migration: `npm run db:migrate -- --name what_changed` |
| `native/` | Rust: `links/` is the logic (plain `cargo test`), `src/` the Node wrapper |
| `../shared/` | request and response types shared with the app, plus the pure calorie and nutrition code both sides must agree on |
| `test/` | integration tests; they talk to a real PostgreSQL and never mock the database |

## How sign-in works

- Passwords are hashed with Argon2id; only the hash is stored.
- An access token (15 minutes, signed) goes in `Authorization: Bearer ...`. A refresh token (60 days) is stored
  hashed and works **once**: each refresh returns a new pair. If an already-used refresh token is shown again
  after a 10 second retry window, it leaked, so that whole chain of sign-ins is revoked.
- Logging out ends the chain; "log out everywhere" ends all of a person's chains; a password reset ends all of them.
- Google and Apple ID tokens are verified against the providers' published keys. A Google or Apple email is only
  joined to an existing account when the provider says the email is verified.
- Sign-in endpoints are limited to 10 attempts a minute per address (`AUTH_RATE_LIMIT_MAX`).

## Configuration

See `.env.example` for every setting. A bad or missing setting stops the server at startup with one clear message.
`JWT_SECRET` must be 32+ random characters; production reads it from the server's environment, never from the repo.

## Things to know

- **Search.** `GET /v1/recipes?q=...` uses PostgreSQL full text plus trigram matching (so "jolof" finds "Jollof Rice"),
  ranks the best 200 matches, then applies the filters. It needs the `pg_trgm` extension; the migration creates it.
- **Likes, saves, ratings and comments keep running totals on the recipe.** They change in the same transaction as
  the row, repeating a request changes nothing, and deleting an account recounts the recipes it touched.
- **Three different people reporting a recipe hide it** until an admin restores it (`PATCH` with `status: published`).
- **Subscriptions come from RevenueCat's webhook.** Set `REVENUECAT_WEBHOOK_SECRET`, then in the RevenueCat dashboard point a webhook at `/v1/webhooks/revenuecat` with the Authorization header `Bearer <that secret>`. The app must sign in to RevenueCat with the enplace user id. `GET /v1/me/entitlements` reports the plan; the server enforces it (Pro-only recipes answer `upgrade_required`, paying people get no ads). Without the secret the webhook answers 501.
- **Live chat.** Connect a WebSocket to `/v1/ws` and send `{"type":"auth","token":"<access token>"}` within 10 seconds. The server answers `ready` (with who is online among your chat partners), then pushes `event` frames (`message.new`, `receipt`, `reaction`, `message.deleted`, `conversation.updated`), `typing` and `presence`. You send `ping`, `ack` (this phone has everything up to a number) and `typing`; messages themselves are sent with the normal request, so they work offline-first and resend safely. A phone that was away asks `GET /v1/conversations/:id/messages?afterSeq=N` to catch up. Frame types are in `shared/chat.ts`. A connection ends when its person logs out (checked every minute) and a sixth phone replaces the oldest. People with no live connection get an Expo push notification unless they muted the chat; set `EXPO_ACCESS_TOKEN` only if the Expo project requires it.
- **Uploads.** `POST /v1/uploads` returns a link; the phone PUTs the file to it with the given headers, then calls `/complete`, where the server checks the real size and type before the file counts. Set all of `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and `STORAGE_PUBLIC_URL` (an R2 bucket with a public domain), or none; with none, uploads answer 501. Phones need no CORS rule. Unfinished uploads are swept after a day by the job runner (`UploadService.sweepExpired`).
- **A cancelled plan keeps working until the paid period ends**; a period that has run out counts as free even if the expiry event has not arrived yet.

- **Rate limits and Cloudflare.** `TRUST_PROXY=true` takes the visitor's address from `cf-connecting-ip`. Only turn
  it on when the server accepts traffic from Cloudflare alone (firewall), or anyone could fake the header.
- **No email provider yet.** Reset emails go to the log (the link only outside production) until one is chosen.
- **Expired sessions and resets** are not yet deleted automatically; a cleanup job comes with the background-jobs work.
