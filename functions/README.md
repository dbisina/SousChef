# Firebase Cloud Functions for SousChef

YouTube video download service using ytdl-core.

## Setup

### 1. Install Firebase CLI (if not already installed)

```bash
npm install -g firebase-tools
```

### 2. Login to Firebase

```bash
firebase login
```

### 3. Initialize Firebase Functions (if not already done)

```bash
cd functions
npm install
```

### 4. Deploy the Cloud Function

```bash
npm run deploy
```

This will deploy the `downloadYouTubeVideo` function to Firebase.

### 5. Configure the Function URL

After deployment, you'll see output like:

```bash
✔  Deploy complete!

Function URL (downloadYouTubeVideo):
https://us-central1-souschef-c23d6.cloudfunctions.net/downloadYouTubeVideo
```

This URL has already been added to your `.env` file:

```bash
EXPO_PUBLIC_YOUTUBE_DOWNLOAD_FUNCTION_URL=https://us-central1-souschef-c23d6.cloudfunctions.net/downloadYouTubeVideo
```

## How It Works

1. **App sends YouTube URL** to Cloud Function
2. **Function downloads video** using ytdl-core at lowest quality (144p/240p)
3. **Video uploaded to Firebase Storage** with 1-hour expiration
4. **Function returns signed URL** (valid for 1 hour)
5. **App downloads video** from signed URL for Gemini analysis
6. **Video auto-deleted** after 2 hours (cleanup)

## Cost Estimation

- **Cloud Functions**: Free tier includes 2M invocations/month
- **Storage**: ~10-15MB per video, auto-deleted after 2 hours
- **Bandwidth**: Outbound data transfer (downloads)

For typical usage (10-20 imports/day), this should stay within Firebase free tier.

## Troubleshooting

### Function deployment fails

```bash
# Check Firebase project
firebase projects:list

# Ensure you're using the correct project
firebase use [project-id]

# Try deploying again
npm run deploy
```

### Function times out

The function has a 9-minute timeout. Very long videos may exceed this. The function automatically selects the lowest quality to minimize file size.

### ytdl-core issues

If you encounter issues with ytdl-core, you can switch to yt-dlp:

1. Update `package.json` to use `yt-dlp-wrap`
2. Update `index.js` to use yt-dlp binary

## Alternative: Local Development

Test the function locally using Firebase emulators:

```bash
npm run serve
```

This starts the function at: `http://localhost:5001/[project-id]/us-central1/downloadYouTubeVideo`

Update your `.env` for local testing:

```bash
EXPO_PUBLIC_YOUTUBE_DOWNLOAD_FUNCTION_URL=http://localhost:5001/[project-id]/us-central1/downloadYouTubeVideo
```
