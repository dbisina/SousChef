/**
 * YouTube Video Download Service
 *
 * Uses Firebase Cloud Function to download YouTube videos at low quality
 * for recipe analysis with Gemini AI.
 */

// Cloud Function URL - update this after deploying
const CLOUD_FUNCTION_URL =
  process.env.EXPO_PUBLIC_YOUTUBE_DOWNLOAD_FUNCTION_URL ||
  'https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/downloadYouTubeVideo';

export interface YouTubeDownloadResult {
  videoUrl: string;
  expiresAt: string;
  quality: string;
  videoId: string;
}

/**
 * Download a YouTube video using the Cloud Function
 * Returns a temporary signed URL to the downloaded video (valid for 1 hour)
 */
export const downloadYouTubeVideo = async (
  youtubeUrl: string
): Promise<YouTubeDownloadResult | null> => {
  try {
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: youtubeUrl }),
    });

    if (!response.ok) {
      return null;
    }

    const data: YouTubeDownloadResult = await response.json();
    return data;
  } catch (error) {
    return null;
  }
};

/**
 * Check if the Cloud Function is configured
 */
export const isYouTubeDownloadAvailable = (): boolean => {
  return !CLOUD_FUNCTION_URL.includes('YOUR-PROJECT-ID');
};
