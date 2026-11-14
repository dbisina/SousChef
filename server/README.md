# SousChef server

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
| `prisma/schema.prisma` | the database. Every change needs a migration: `npm run db:migrate -- --name what_changed` |
| `native/` | Rust: `links/` is the logic (plain `cargo test`), `src/` the Node wrapper |
| `../shared/` | request and response types shared with the app |
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

- **Rate limits and Cloudflare.** `TRUST_PROXY=true` takes the visitor's address from `cf-connecting-ip`. Only turn
  it on when the server accepts traffic from Cloudflare alone (firewall), or anyone could fake the header.
- **No email provider yet.** Reset emails go to the log (the link only outside production) until one is chosen.
- **Expired sessions and resets** are not yet deleted automatically; a cleanup job comes with the background-jobs work.
