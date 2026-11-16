# SousChef staff dashboard

A small static website (Vite + React + TypeScript) for staff. It talks to the server's `/v1/admin/*` routes and signs in with a normal SousChef account whose role is ADMIN; any other account is signed straight back out.

| Page | What staff can do |
|---|---|
| Overview | People, new people, posts, open reports, waiting chef requests, AI spend against the monthly budget |
| Reports | Hide, restore or dismiss a reported post; suspend the author |
| Chef verification | Approve, reject (with a reason shown to the person) or revoke the badge |
| AI | Spend by provider, task and day; which providers and Gemini free keys are ready or resting (last four characters only) |
| Ads | Pause, activate or delete sponsored cards; move advertising enquiries along |
| Official accounts | Hide or show every official SousChef post (the kill switch); see the Daily Dish puzzle list (read only) |

## Run it

```bash
npm install
npm run dev        # http://localhost:5174, forwards /v1 to the API on port 3000
npm test           # api client, formatting, sign-in flow
npm run build      # static files in dist/, served by Caddy at /admin/
```

Tokens are kept in `sessionStorage` (gone when the tab closes). The site is built to run under `/admin/` on the same address as the API, so no CORS is needed. See `docs/runbook.md`, "Staff dashboard", for hosting.
