import React, { useState, useCallback } from 'react';
import { View, Text, Dimensions, TouchableOpacity } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons';

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
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const videoId = extractVideoId(videoUrl);
  const screenWidth = Dimensions.get('window').width;
  const playerHeight = (screenWidth - 32) * (9 / 16); // 16:9 aspect ratio with padding

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
      <View className="bg-neutral-100 rounded-xl p-6 items-center justify-center" style={{ height: playerHeight }}>
        <Ionicons name="videocam-off-outline" size={40} color="#737373" />
        <Text className="text-neutral-500 mt-2 text-center">Invalid YouTube URL</Text>
      </View>
    );
  }

  if (hasError) {
    return (
      <View className="bg-neutral-100 rounded-xl p-6 items-center justify-center" style={{ height: playerHeight }}>
        <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
        <Text className="text-neutral-500 mt-2 text-center">Failed to load video</Text>
        <TouchableOpacity
          onPress={() => setHasError(false)}
          className="mt-3 px-4 py-2 bg-primary-500 rounded-lg"
        >
          <Text className="text-white font-medium">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="rounded-xl overflow-hidden bg-black">
      {!isReady && (
        <View
          className="absolute inset-0 bg-neutral-200 items-center justify-center z-10"
          style={{ height: playerHeight }}
        >
          <Ionicons name="play-circle" size={48} color="#737373" />
          <Text className="text-neutral-500 mt-2">Loading video...</Text>
        </View>
      )}
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
