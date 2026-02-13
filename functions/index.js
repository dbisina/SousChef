/**
 * Firebase Cloud Functions for SousChef
 *
 * YouTube Video Download Function
 * - Downloads YouTube videos at lowest quality (144p/240p)
 * - Uploads to Firebase Storage with 1-hour expiration
 * - Returns signed URL for download
 */

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const YTDlpWrap = require('yt-dlp-wrap').default;
const os = require('os');
const path = require('path');
const fs = require('fs').promises;

admin.initializeApp();

// Initialize yt-dlp
const ytDlpPath = path.join(os.tmpdir(), 'yt-dlp');
const ytDlp = new YTDlpWrap(ytDlpPath);

/**
 * Download YouTube video at lowest quality
 * POST /downloadYouTubeVideo
 * Body: { url: string }
 * Returns: { videoUrl: string, expiresAt: string }
 */
exports.downloadYouTubeVideo = onRequest(
  {
    timeoutSeconds: 540, // 9 minutes max
    memory: '1GiB',
    cors: true,
  },
  async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url } = req.body;

    // Basic YouTube URL validation
    if (!url || !url.includes('youtube.com') && !url.includes('youtu.be')) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    let tempFilePath = null;

    try {
      // Ensure yt-dlp binary is available
      try {
        await YTDlpWrap.downloadFromGithub(ytDlpPath);
      } catch (downloadError) {
        // yt-dlp already exists or download skipped
      }

      // Extract video ID from URL
      const videoIdMatch = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      const videoId = videoIdMatch ? videoIdMatch[1] : Date.now().toString();

      // Create temp file path
      tempFilePath = path.join(os.tmpdir(), `${videoId}_${Date.now()}.mp4`);

      // Download video at lowest quality using yt-dlp with aggressive bot bypass
      // Try multiple strategies with fallback
      let downloadSuccess = false;
      const strategies = [
        {
          name: 'iOS client (aggressive)',
          args: [
            url,
            '-f', 'worst[ext=mp4]/worst',
            '-o', tempFilePath,
            '--no-playlist',
            '--no-check-certificate',
            '--extractor-args', 'youtube:player_client=ios',
            '--extractor-args', 'youtube:player_skip=webpage,configs',
            '--user-agent', 'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)',
          ]
        },
        {
          name: 'Android VR client',
          args: [
            url,
            '-f', 'worst[ext=mp4]/worst',
            '-o', tempFilePath,
            '--no-playlist',
            '--no-check-certificate',
            '--extractor-args', 'youtube:player_client=android_vr',
            '--user-agent', 'com.google.android.apps.youtube.vr.oculus/1.56.21 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1;)',
          ]
        },
        {
          name: 'Android embedded',
          args: [
            url,
            '-f', 'worst[ext=mp4]/worst',
            '-o', tempFilePath,
            '--no-playlist',
            '--no-check-certificate',
            '--extractor-args', 'youtube:player_client=android_embedded',
            '--user-agent', 'com.google.android.youtube/19.29.37 (Linux; U; Android 14; en_US;)',
          ]
        },
        {
          name: 'TV embedded',
          args: [
            url,
            '-f', 'worst[ext=mp4]/worst',
            '-o', tempFilePath,
            '--no-playlist',
            '--no-check-certificate',
            '--extractor-args', 'youtube:player_client=tv_embedded',
          ]
        }
      ];

      for (const strategy of strategies) {
        try {
          await ytDlp.execPromise(strategy.args);
          downloadSuccess = true;
          break;
        } catch (strategyError) {
          // Continue to next strategy
        }
      }

      if (!downloadSuccess) {
        throw new Error('All download strategies failed. YouTube may be blocking automated access.');
      }

      // Get file stats
      const stats = await fs.stat(tempFilePath);
      const fileSizeMB = stats.size / (1024 * 1024);

      // Upload to Firebase Storage
      const bucket = admin.storage().bucket();
      const fileName = `youtube-temp/${videoId}_${Date.now()}.mp4`;

      await bucket.upload(tempFilePath, {
        destination: fileName,
        metadata: {
          contentType: 'video/mp4',
          metadata: {
            videoId: videoId,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          },
        },
      });

      // Clean up temp file
      await fs.unlink(tempFilePath);
      tempFilePath = null;

      // Get file reference and generate signed URL
      const file = bucket.file(fileName);
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000, // 1 hour from now
      });

      // Schedule deletion after 2 hours (cleanup)
      setTimeout(async () => {
        try {
          await file.delete();
        } catch (error) {
          // Error deleting expired video
        }
      }, 2 * 60 * 60 * 1000); // 2 hours

      return res.status(200).json({
        videoUrl: signedUrl,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        quality: 'lowest',
        videoId: videoId,
        fileSizeMB: parseFloat(fileSizeMB.toFixed(2)),
      });
    } catch (error) {
      // Clean up temp file if it exists
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          // Error cleaning up temp file
        }
      }

      return res.status(500).json({
        error: 'Failed to download YouTube video',
        message: error.message,
      });
    }
  }
);
