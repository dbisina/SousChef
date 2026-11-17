# Before the store builds: what is done, what needs the owner

Nothing here has been built for the stores. Order agreed: finish and test locally, run compliance, then build.

## Done in this round (local tests green; deployed to the test host)
- Fixed food photos are back (`mobile/assets/photos/`): Meal Plan, Pantry, Shopping, cookbook covers. People's pictures still come only from the server.
- Game questions carry a real, licence-checked Wikipedia/Commons photo of what they are about (stored on our own file store). `npm run seed -- --photos` gives existing questions photos, N at a time.
- Solo Mystery Kitchen starts straight away. Daily Dish shows a clear clue state instead of bare "?" chips.
- Cooking "Back to Home" and the close X dismiss the cooking screen instead of stacking home on top; "Share your creation" is an in-screen overlay so its close button works.
- Home header: plus (paste link) on the left, enplace centred, no logo; "What can I cook tonight?" sits mid-feed.
- Settings icon is a gear; settings has Report a bug and Contact the developer (addresses `support@souschef.app` and `developers@souschef.app`: create these mailboxes).
- Usernames: `@handle` chosen in Edit profile with a live availability check; shown on profiles; follower and following counts come from the server (this fixed follows "not updating").
- Imports: TikTok/Instagram/YouTube links with no recipe in the caption are read by downloading a small copy on the server (yt-dlp + ffmpeg) and having a vision model read pictures from it. The app no longer asks for screenshots. Typing what you want to cook searches the web (Tavily, then Brave); with neither key set, the model writes a standard recipe and the app says so.

## Video downloads (tested live)
- YouTube and Instagram reels: the server downloads a picture-only copy (yt-dlp + ffmpeg) and a vision model reads it.
- TikTok refuses the host address, so the phone resolves the video file address and cookie and the server downloads that file.
- Optional: `YT_DLP_COOKIES_PATH` (cookies file from a logged-in account) for Instagram posts that need a login; not needed for public reels. `IMPORT_PROXY_URL` routes yt-dlp through a proxy.

## Also fixed
- `mobile/GoogleService-Info.plist` now has the capital I that `app.json` expects (EAS runs on Linux, which is case sensitive).

## Needs the owner
1. **Search keys:** set `TAVILY_API_KEY` and/or `BRAVE_SEARCH_API_KEY` on the host. Without them "I want to cook X" gets an AI-written recipe.
2. **Nebius image generation is gone** (its images endpoint returns 404; Nebius reportedly shut it down in April 2026), so generated pictures are not possible per-token there. Photos come from Wikimedia instead. If generated art is wanted (meal plan/shopping hero images), it has to be made by hand (ChatGPT) or with another provider; Claude in Chrome was not connected this session.
3. **Firebase naming:** the Firebase project id is `souschef-c23d6`. The "project-…" wording people see is the sender/auth-domain display in the Firebase console: Project settings > Public-facing name (set it to enplace), and Authentication > Templates (sender name, action URL). This cannot be changed from the code.
4. **Bundle id** `com.lyon98.souschef` contains a personal handle. Changing it before the first store listing is free; after it ships it is not. Decide now.
5. **R2 + Cloudinary:** storage is S3-compatible, so R2 is configuration only (`S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, bucket, keys, `STORAGE_PUBLIC_URL`). Cloudinary (image resizing/CDN) would be a second adapter: recommended to put it in front of R2 as a delivery URL transform rather than as a second store.
6. **Revenue:** subscriptions (free / premium / pro) and house ad slots already exist. Decide prices and set up App Store / Play products and the webhook secrets before compliance.
7. **Rotate** any keys that were pasted in chat before production.
