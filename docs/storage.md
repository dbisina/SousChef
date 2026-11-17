# Storage and image delivery: Cloudflare R2 + Cloudinary

Two jobs, two services, one URL scheme.

| Job | Service | Why |
|---|---|---|
| **Keep the files** (avatars, banners, post photos, recipe photos, game photos, voice notes) | **Cloudflare R2** bucket `souschef-media` | S3-compatible, no charge for data leaving it (egress), cheap storage. The server already speaks S3 (`server/src/storage/`). |
| **Deliver pictures** to phones | **Cloudinary**, in "fetch" mode in front of R2 | Resizes and compresses on the fly (`f_auto,q_auto`: WebP/AVIF where supported) and caches on its CDN, so a 2 MB original becomes a 30-80 KB picture on mobile data. |

```
phone ── PUT (presigned) ──────────────▶ R2 bucket   (uploads go straight to R2)
phone ◀─ https://res.cloudinary.com/<cloud>/image/fetch/f_auto,q_auto,w_640/<R2 public URL>
                                   │ (first time only)
                                   └── Cloudinary fetches the original from R2, resizes, caches
```

The database keeps the plain R2 address of each file (never the Cloudinary one), so Cloudinary can be switched off or replaced
without touching any data. The app turns a stored address into a Cloudinary one at display time (`mobile/lib/mediaUrl.ts`, used
by photo cards and avatars). Files on the phone, other sites' pictures and bundled images are never changed.

## Status (2026-11-17)
- **R2: live.** Bucket `souschef-media`, public address `https://pub-2bc1cfca634f4813a0dd4a2d957c7926.r2.dev` (Cloudflare's development address: fine for now, but rate-limited; attach a custom domain such as `media.souschef.app` before launch and change `STORAGE_PUBLIC_URL`). A bucket-only read/write access key was created and set on the Railway API service. A real avatar upload through the server was checked end to end (upload link, file in R2, public read).
- **Previous settings** (to roll back): `S3_ENDPOINT=https://s3store-production.up.railway.app`, `S3_BUCKET=souschef`, `S3_REGION=us-east-1`, `STORAGE_PUBLIC_URL=https://s3store-production.up.railway.app/souschef` (with that service's own key and secret).
- **Cloudinary: live.** Cloud `drk6rje53`; fetch checked end to end (an R2 image returns 200 through Cloudinary, other hosts are refused). Allowed fetch domains: the R2 public host and the old Railway bucket host; "Fetched URL" is no longer a restricted type. App env is in `mobile/eas.json` (`EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`, `EXPO_PUBLIC_MEDIA_HOSTS`).

## What exists
- Bucket `souschef-media` (Cloudflare account, location ENAM, standard storage). Created.
- Server: nothing to change in code; it uses R2 now that the `S3_*` settings below are set on Railway.
- App: `lib/mediaUrl.ts` + `PhotoCard` and `UAvatar` use it. With no Cloudinary name set, behaviour is exactly as before.

## What still needs doing
1. ~~Cloudinary~~ done (see Status).
2. Before launch: attach a **custom domain** to the bucket (Cloudflare > R2 > souschef-media > Settings > Custom Domains) and change `STORAGE_PUBLIC_URL` to it. The `r2.dev` address is rate-limited and Cloudflare asks that it not be used for production.

## Settings
Server (Railway `souschef-api` variables, and `server/.env.example`):
```
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_BUCKET=souschef-media
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_REGION=auto
STORAGE_PUBLIC_URL=https://<the public address from step 2>
```
App (EAS environment / `mobile/.env`):
```
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=<cloud name>
EXPO_PUBLIC_MEDIA_HOSTS=<R2 public host>,s3store-production.up.railway.app
```

## Existing files
Everything uploaded so far (seed photos, game photos, test uploads) is on the old Railway bucket (`s3store-production.up.railway.app`),
and the database holds those addresses. They keep working as they are. Only new uploads go to R2 after the switch. Copying the old
files across (and rewriting the addresses) is a separate one-off job; list the old host in `EXPO_PUBLIC_MEDIA_HOSTS` until then so
those pictures are also resized.

## Cost notes
R2: storage per GB-month, no egress fees; Cloudinary free plan has a monthly transformation/bandwidth credit. The CDN cache means a
picture is transformed once per size, not once per view. Step pictures made by AI (paid plans only) are stored here too, once per step.
