import React, { useEffect, useMemo, useState } from 'react';
import { Text as RNText, View, type LayoutChangeEvent } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useTranslation } from 'react-i18next';
import { Pressable } from '@/components/ui/Pressable';
import { FONT } from '@/components/ui/fonts';
import { Icon, useTokens } from '@/components/ui';
import { formatClock, nextPlaybackRate, resampleBars } from '@/lib/chatLogic';
import { feedback, restoreUiAudioMode } from '@/lib/feedback';
import { useVoicePlaybackStore } from '@/lib/voiceNotes';
import { FIXED } from '@/stores/themeStore';

const BARS = 28;
const BAR_W = 2.5;
const BAR_GAP = 2;
const WAVE_H = 28;

interface Props {
  /** Message id: only one voice note plays at a time. */
  id: string;
  /** Recording file. Sample notes have none. */
  uri?: string;
  durationSec: number;
  waveform: number[];
  /** On my own (dark) bubble. */
  me: boolean;
  /** Pressed play on a note that has no audio (sample data). */
  onNoAudio?: () => void;
}

/**
 * Play / pause, a waveform that fills as the note plays (tap it to jump), and a speed chip (1x, 1.5x, 2x).
 * Used by chat voice notes and voice comments.
 */
export function VoicePlayer({ id, uri, durationSec, waveform, me, onNoAudio }: Props) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const source = useMemo(() => (uri ? { uri } : undefined), [uri]);
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const activeId = useVoicePlaybackStore((s) => s.activeId);
  const setActive = useVoicePlaybackStore((s) => s.setActive);
  const [rate, setRate] = useState(1);
  const [width, setWidth] = useState(0);

  const total = status.duration > 0 ? status.duration : durationSec;
  const progress = total > 0 ? Math.min(1, status.currentTime / total) : 0;
  const bars = useMemo(() => resampleBars(waveform, BARS), [waveform]);

  // Another note started: stop this one.
  useEffect(() => {
    if (activeId !== id && status.playing) player.pause();
  }, [activeId, id, status.playing, player]);

  // Finished: back to the start, release the audio session.
  useEffect(() => {
    if (!status.didJustFinish) return;
    void player.seekTo(0);
    setActive(null);
    void restoreUiAudioMode();
  }, [status.didJustFinish, player, setActive]);

  const toggle = async () => {
    if (!uri) {
      onNoAudio?.();
      return;
    }
    if (status.playing) {
      player.pause();
      setActive(null);
      void restoreUiAudioMode();
      return;
    }
    try {
      // Voice notes play even when the phone is on silent, like other messaging apps.
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        allowsRecording: false,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      setActive(id);
      player.setPlaybackRate(rate);
      player.play();
      feedback.select();
    } catch {
      setActive(null);
    }
  };

  const cycleRate = () => {
    const next = nextPlaybackRate(rate);
    setRate(next);
    player.setPlaybackRate(next);
    feedback.select();
  };

  const playedColor = me ? tokens['ink-inverse'] : tokens.ink;
  const restColor = me ? tokens.subtle : tokens.line;
  const label = status.playing ? formatClock(Math.max(0, total - status.currentTime) * 1000) : formatClock(durationSec * 1000);

  return (
    <View
      accessible
      accessibilityLabel={t('chat.voiceMessage', 'Voice message, {{duration}}', { duration: formatClock(durationSec * 1000) })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? t('chat.pauseVoice', 'Pause') : t('chat.playVoice', 'Play')}
        onPress={toggle}
        hitSlop={6}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: FIXED.paper,
        }}
      >
        <Icon name={status.playing ? 'pause' : 'play'} size="sm" color="night" filled />
      </Pressable>

      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel={t('chat.seekVoice', 'Jump in the voice message')}
        onPress={(e) => {
          if (!uri || width <= 0) return onNoAudio?.();
          void player.seekTo(Math.max(0, Math.min(1, e.nativeEvent.locationX / width)) * total);
        }}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={{ flex: 1, height: WAVE_H, justifyContent: 'center' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: BAR_GAP, height: WAVE_H }}>
          {bars.map((h, i) => (
            <View
              key={i}
              style={{
                width: BAR_W,
                height: Math.max(3, (h / 100) * WAVE_H),
                borderRadius: BAR_W / 2,
                backgroundColor: (i + 0.5) / BARS <= progress ? playedColor : restColor,
              }}
            />
          ))}
        </View>
      </Pressable>

      {status.playing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('chat.voiceSpeed', 'Playback speed {{rate}}x', { rate })}
          onPress={cycleRate}
          hitSlop={8}
          style={{
            minWidth: 34,
            height: 22,
            paddingHorizontal: 6,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: FIXED.paper,
          }}
        >
          <RNText style={{ fontFamily: FONT.sansSemi, fontSize: 11, color: FIXED.night }}>{rate}x</RNText>
        </Pressable>
      ) : (
        <RNText style={{ fontFamily: FONT.sans, fontSize: 12, color: me ? tokens['ink-inverse'] : tokens.muted, minWidth: 34 }}>
          {label}
        </RNText>
      )}
    </View>
  );
}
