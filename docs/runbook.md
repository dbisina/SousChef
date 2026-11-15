# SousChef backend runbook

How the server is set up, how to put a new version live, and what to do when something goes wrong.
Everything in `deploy/` was written and checked by reading and by syntax checks, **not run on a real server**. The first
deploy is a rehearsal: do it on the day you have time to fix things.

## What runs where

One server (OVH, 8 GB) runs three containers from `deploy/docker-compose.prod.yml`:

| Container | Job | Memory cap |
|---|---|---|
| `db` | PostgreSQL 16 (never published to the internet) | 1.5 GB |
| `api` | the Node server: REST, live chat WebSocket, background jobs | 768 MB |
| `caddy` | TLS with the Cloudflare Origin certificate, passes requests to `api` | 128 MB |

In front: Cloudflare (DNS, protection, caching of public files). Files (photos, voice notes) live in a Cloudflare R2
bucket; the phone uploads straight there with a link the server makes. Backups go to a **second, private** R2 bucket.

Monthly cost to expect: server about $6 to $12 depending on plan, R2 inside its free tier at first, domain about $1.
AI spend is capped by `AI_MONTHLY_BUDGET_USD` (a hard stop, default 5).

## First-time setup (once)

1. **Server.** Create the OVH VPS (Ubuntu 24.04). Create a normal user `deploy` with your SSH key; turn off password and root SSH login. Install Docker (with the compose plugin), `awscli`, `age`.
2. **Folder.** `sudo mkdir -p /opt/souschef/certs && sudo chown -R deploy /opt/souschef`.
3. **Domain and Cloudflare.** Add the domain to Cloudflare. Create an `A` record `api` pointing at the server, proxied (orange cloud). SSL/TLS mode: **Full (strict)**. Create an **Origin Certificate** for `api.<your domain>` and save it as `/opt/souschef/certs/origin.pem` and `origin.key` (mode 600).
4. **R2.** Make two buckets: `souschef-media` (public through a custom domain, for example `media.<your domain>`) and `souschef-backups` (private). Make one API token limited to the media bucket and one limited to the backups bucket. Add an R2 lifecycle rule on `souschef-backups` to delete `daily/` objects after 30 days.
5. **Settings.** Copy `deploy/.env.example` to `/opt/souschef/.env` and `deploy/.env.production.example` to `/opt/souschef/.env.production`; fill both in. Generate secrets with the commands in those files. **Write down `HEALTH_DATA_KEY` somewhere safe and separate from the backups** — without it, saved health readings are unreadable.
6. **Backups.** Make an `age` key pair on your own computer (`age-keygen -o souschef-backup.key`). Keep the private key offline (password manager and a printed copy). Put only the public key (`age1...`) in `/opt/souschef/.env.backup` with the other backup settings listed at the top of `backup.sh`. Add the cron line shown there. Create a free check at healthchecks.io and put its address in `HEALTHCHECK_URL` so a missed backup emails you.
7. **Firewall.** `sudo ./cloudflare-firewall.sh`, then `sudo apt install iptables-persistent && sudo netfilter-persistent save`. Allow SSH only from your own address (ufw) or use a VPN. Check from a phone on mobile data that `https://api.<domain>/readyz` still answers, and that `http://<server ip>` does not.
8. **Registry login.** `docker login ghcr.io` on the server with a token that can only read packages.
9. **GitHub secrets** for the deploy workflow: see the top of `.github/workflows/deploy.yml`.
10. **First deploy.** Run the `deploy` workflow from the Actions tab. When it finishes, `curl https://api.<domain>/readyz` should say `ok`.
11. **Staff and puzzles.** Make yourself staff: `docker compose -f docker-compose.prod.yml exec db psql -U souschef -c "UPDATE \"User\" SET role='ADMIN' WHERE email='you@example.com'"`. Then load the Daily Dish puzzles with `PUT /v1/admin/daily-puzzles`.
12. **Restore test.** Wait one night, then run `AGE_IDENTITY=~/souschef-backup.key ./restore-test.sh`. Until it passes once, you do not have backups, you have hopes.

## Putting a new version live

Run the **deploy** workflow (Actions tab), or push a tag like `server-v0.2.0`. It builds the images, copies the
deploy files, and runs `./deploy.sh <tag>` on the server, which: takes a backup, applies database migrations, starts the
new API, waits for `healthy`, and **puts the old version back if the new one does not come up**.

Rules that keep that rollback safe: a migration may add tables and columns, but removing or renaming something is done in
two releases (stop using it, then drop it later). If a migration cannot be undone by running the old code against it,
say so in the pull request.

By hand: `cd /opt/souschef && ./deploy.sh <tag>`. See what is live: `cat .current-tag`. Go back: `./deploy.sh $(cat .previous-tag)`.

## Watching it

- **Is it up?** Point a free uptime monitor (UptimeRobot, Better Stack) at `https://api.<domain>/readyz` (checks the database too) every minute.
- **Logs.** `docker compose -f docker-compose.prod.yml logs -f --tail 100 api`. Slow database queries (over 0.5 s) show in the `db` logs.
- **Memory.** `docker stats --no-stream`. The API should sit well under 768 MB and the database under 1.5 GB.
- **AI spend.** Staff can see it in the `AiUsage` table: `SELECT sum("costMicros")/1e6 FROM "AiUsage" WHERE "createdAt" >= date_trunc('month', now());`
- **Background jobs.** They log what they did (for example `games finished=1`). A job that fails is retried at its next time; look for `job failed` in the logs.

## When something goes wrong

| What you see | What to do |
|---|---|
| `readyz` is failing | `docker compose ... ps`; check `db` is healthy and the disk is not full (`df -h`). Restart the API: `docker compose ... restart api`. |
| Deploy printed "did not become healthy" | It already put the old version back. Read the logged lines; usually a missing setting in `.env.production`. |
| Disk nearly full | Old Docker images: `docker image prune -a`. Logs are capped at 50 MB per container. Large tables: look at `pg_total_relation_size`. |
| AI features say "resting" | Either the monthly budget is spent (raise `AI_MONTHLY_BUDGET_USD` if you accept it) or a provider key is missing or wrong. Imports and the plate judge degrade; moderation waits. |
| Someone posts something awful | Staff: hide it from the report queue (`/v1/admin/reports`), suspend the account (`POST /v1/admin/users/:id/suspend`). |
| A key or secret leaked | Replace it in `.env.production`, `./deploy.sh $(cat .current-tag)`. For `JWT_SECRET`, everyone is signed out (expected). Never rotate `HEALTH_DATA_KEY` without re-encrypting the stored data first (there is no tool for that yet). |
| Database lost | New server, same setup steps, then restore the newest backup (see `restore-test.sh` for the exact commands, but into the real database). Expect to lose up to a day. |

## Gemini key pool

- `AI_GEMINI_API_KEY` is the funded key. `AI_GEMINI_FREE_KEYS` is a comma-separated list of keys without billing.
- Ordinary requests rotate across the free keys (cost 0, recorded as provider `gemini-free`). A key that is rate limited rests 1 minute, then 2, 4... up to 6 hours; a key Google refuses (wrong or suspended) is left out for a day. The server logs only the last four characters of a key.
- Private requests (health summary, chat helper, pantry-scan photos), video, and any task in `AI_GEMINI_PAID_ONLY_TASKS` use the funded key only. If there is no funded key, those features say they are resting rather than use a free key or DeepSeek.
- When every free key is resting the funded key takes ordinary requests too (`AI_GEMINI_SPILL_TO_PAID=false` makes them fall back to DeepSeek instead). The monthly budget counts only funded usage.
- See what happened: `SELECT provider, count(*), sum("costMicros") FROM "AiUsage" WHERE "createdAt" > now() - interval '7 days' GROUP BY provider;`
- Free keys vanish if Google changes limits or suspends them. Read Google's Gemini API terms before relying on keys from several accounts.

## Starter content (official accounts, recipes, puzzles)

A fresh server is empty. `npm run seed` adds the official SousChef accounts (Kitchen, Baking, Quick Meals), the 10 starter recipes and 3 cookbooks that used to live in Firestore (once each, under those accounts), 9 official posts and 14 Daily Dish puzzles. It only adds what is missing, never changes puzzles staff have set, and is safe to run again.

```bash
npm run seed -- --dry-run                      # say what would be added
npm run seed                                   # add it
npm run seed -- --admin you@example.com        # also make an existing account staff (register in the app first)
```

On the server: `docker compose ... exec api npm run seed`. On the Railway test host: `railway ssh --service souschef-api -- npm run seed -- --admin you@example.com`.

The recipe and cookbook data is `server/seed/content.json`, exported once from Firestore by `server/scripts/export-firestore.mjs` (read-only; drops authors, users, emails and push tokens). Photos are web links, not uploads.

### Pointing the app at a server

Set `EXPO_PUBLIC_API_URL=https://<your host>` in the app's environment (the local `.env`, or `eas env:create` for EAS builds) and restart Expo with `npx expo start -c`. Without it the app keeps using Firebase.

## Staff dashboard

`admin/` is a static website (Vite + React) for staff: reports, chef verification, AI spend and key status, ads, official accounts. It is served by Caddy at `https://<API_DOMAIN>/admin/` next to the API, so it needs no extra process and no CORS.

1. Build it: `cd admin && npm ci && npm run build` (output in `admin/dist`).
2. Copy it to the server: `rsync -a --delete admin/dist/ <user>@<host>:/opt/souschef/admin/`. Caddy picks up new files at once; no restart.
3. Open `/admin/` and sign in with an account whose role is ADMIN. Anyone else is signed straight back out.
4. Optional: in Cloudflare, put the path `/admin/*` behind Cloudflare Access (or an IP allow-list) as a second lock.

Development: run the API on port 3000, then `cd admin && npm run dev` (port 5174; `/v1` is forwarded to the API).

## Measuring

`server/scripts/loadtest.mjs` creates test accounts, holds live-chat connections, and sends mixed requests, then prints
speed and errors. Run it against a staging copy, not production. The memory and speed numbers in the plan are estimates
until you have run this on the real server size; do it before the first real users.

## Known gaps

- Nothing here has been run on a real server, R2 bucket or Cloudflare account yet.
- No automatic key rotation for `HEALTH_DATA_KEY`.
- One server means one point of failure: a bad night means minutes to an hour of downtime, and up to a day of data lost in the worst case. Move to a managed database when real money depends on it.
- Only posts and post comments go through the quick rules, and only posts through the model check. Chat messages and recipe comments are not checked yet (people can still report them).
