import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/** The brand colours, for where a card has no photo of its own (never a stand-in picture). */
export function Backdrop() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['#1C1C1C', '#7C2D12', '#F97316']}
      locations={[0, 0.55, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
