import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';

interface StepClipProps {
  /** The clip for the step being cooked (a short silent mp4). */
  uri: string;
}

/**
 * The step's clip, looping and muted, filling the space behind the cook screen's controls. Dark bands at the top and bottom keep
 * the buttons and the progress bar readable over any footage. It never takes over the sound (the voice helper and timers stay audible).
 */
export function StepClip({ uri }: StepClipProps) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    // A new step gives a new address: the player is rebuilt for it, so start it again.
    player.muted = true;
    player.loop = true;
    player.play();
    return () => {
      try {
        player.pause();
      } catch {
        // already released
      }
    };
  }, [player, uri]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} />
      <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']} locations={[0, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120 }} />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} locations={[0, 1]} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 }} />
    </View>
  );
}
