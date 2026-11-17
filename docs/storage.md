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

## What exists
- Bucket `souschef-media` (Cloudflare account, location ENAM, standard storage). Created.
- Server: nothing to change. It uses R2 as soon as the `S3_*` settings below are set.
- App: `lib/mediaUrl.ts` + `PhotoCard` and `UAvatar` use it. With no Cloudinary name set, behaviour is exactly as before.

## What still needs your account (these are secrets or dashboard switches I cannot make from code)
1. **R2 API token** (Cloudflare dashboard > R2 > Manage R2 API tokens > Create, permission "Object Read & Write", limited to
   `souschef-media`). You get an Access Key ID and a Secret Access Key. Your account ID is in the dashboard URL.
2. **Public address for the bucket:** bucket > Settings > either "Public Development URL" (`https://pub-xxxx.r2.dev`, fine to start;
   rate-limited, not for production traffic) or **Custom Domain** (recommended for launch, e.g. `media.souschef.app`).
3. **Cloudinary** (free plan is enough to start): note the **cloud name**; Settings > Security > **Allowed fetch domains**: add the R2 public
   host (and the old bucket host while old files still live there). Without this Cloudinary refuses to fetch (`401`).

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
