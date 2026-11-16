import React, { useState, useCallback } from 'react';
import { View, Text, Dimensions } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { useTranslation } from 'react-i18next';
import { Icon, UButton, FONT } from '@/components/ui';

interface YouTubePlayerProps {
  videoUrl: string;
  autoPlay?: boolean;
}

/**
 * Extract YouTube video ID from various URL formats
 * Supports:
 * - youtube.com/watch?v=VIDEO_ID
 * - youtu.be/VIDEO_ID
 * - youtube.com/embed/VIDEO_ID
 * - youtube.com/v/VIDEO_ID
 * - With or without timestamps and other parameters
 */
const extractVideoId = (url: string): string | null => {
  if (!url) return null;

  const patterns = [
    // Standard YouTube URL
    /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.+&v=)([^&]+)/,
    // Shortened youtu.be URL
    /youtu\.be\/([^?&]+)/,
    // Embed URL
    /youtube\.com\/embed\/([^?&]+)/,
    // Old /v/ URL format
    /youtube\.com\/v\/([^?&]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

/**
 * Validate if a URL is a valid YouTube URL
 */
export const isValidYouTubeUrl = (url: string): boolean => {
  return extractVideoId(url) !== null;
};

/**
 * YouTube URL validation regex pattern for form validation
 */
export const youtubeUrlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/;

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoUrl,
  autoPlay = false,
}) => {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const videoId = extractVideoId(videoUrl);
  const screenWidth = Dimensions.get('window').width;
  const playerHeight = (screenWidth - 40) * (9 / 16); // 16:9 inside the 20px screen gutters

  const onStateChange = useCallback((state: string) => {
    if (state === 'ended') {
      setIsPlaying(false);
    }
  }, []);

  const onReady = useCallback(() => {
    setIsReady(true);
  }, []);

  const onError = useCallback(() => {
    setHasError(true);
  }, []);

  if (!videoId) {
    return (
      <View className="bg-surface items-center justify-center" style={{ height: playerHeight, borderRadius: 28, gap: 8 }}>
        <Icon name="warning" size="lg" color="muted" />
        <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 13 }}>
          {t('cooking.invalidYoutube', 'Invalid YouTube URL')}
        </Text>
      </View>
    );
  }

  if (hasError) {
    return (
      <View className="bg-surface items-center justify-center" style={{ height: playerHeight, borderRadius: 28, gap: 10 }}>
        <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 13 }}>
          {t('cooking.videoFailed', 'Failed to load video')}
        </Text>
        <UButton label={t('cooking.retry', 'Retry')} size="sm" onPress={() => setHasError(false)} />
      </View>
    );
  }

  return (
    <View className="overflow-hidden bg-night" style={{ borderRadius: 28 }}>
      {!isReady ? (
        <View
          className="absolute inset-0 bg-surface-3 items-center justify-center z-10"
          style={{ height: playerHeight, gap: 8 }}
        >
          <Icon name="play" size="lg" color="muted" />
          <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 13 }}>
            {t('cooking.loadingVideo', 'Loading video...')}
          </Text>
        </View>
      ) : null}
      <YoutubePlayer
        height={playerHeight}
        play={isPlaying}
        videoId={videoId}
        onChangeState={onStateChange}
        onReady={onReady}
        onError={onError}
        webViewProps={{
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: false,
        }}
      />
    </View>
  );
};

export default YouTubePlayer;
