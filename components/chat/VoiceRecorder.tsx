import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text as RNText, View } from 'react-native';
import { File } from 'expo-file-system';
import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Pressable } from '@/components/ui/Pressable';
import { FONT } from '@/components/ui/fonts';
import { Icon, UIconButton, useTokens } from '@/components/ui';
import { MAX_VOICE_MS, MIN_VOICE_MS, formatClock, waveformFromMetering } from '@/lib/chatLogic';
import { feedback, restoreUiAudioMode } from '@/lib/feedback';
import { VOICE_RECORDING_OPTIONS } from '@/lib/voiceNotes';

export interface VoiceNote {
  uri: string;
  durationSec: number;
  /** Bar heights 0..100. */
  waveform: number[];
}

export type RecordPhase = 'idle' | 'recording' | 'locked';
type Finish = 'send' | 'cancel' | 'lock';

/** Slide this far left to cancel, this far up to lock. */
export const CANCEL_DX = -96;
export const LOCK_DY = -84;

interface Options {
  onDone: (note: VoiceNote) => void;
  onTooShort: () => void;
  onDenied: () => void;
}

/**
 * Voice note recording. Hold to record, release to send, slide left to cancel, slide up to lock hands-free.
 * Handles the user letting go before the microphone has finished starting.
 */
export function useVoiceNote(options: Options) {
  // Callers pass fresh closures every render; keeping them in a ref keeps begin/finish stable, which the
  // level-collecting effect below depends on (a changing finish would re-run it on every render).
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  });
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const state = useAudioRecorderState(recorder, 70);
  const [phase, setPhaseState] = useState<RecordPhase>('idle');
  const [live, setLive] = useState<number[]>([]);
  const phaseRef = useRef<RecordPhase>('idle');
  const startingRef = useRef(false);
  const pendingRef = useRef<Finish | null>(null);
  const levelsRef = useRef<number[]>([]);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  const setPhase = useCallback((p: RecordPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const finish = useCallback(
    async (action: Finish) => {
      if (action === 'lock') {
        if (phaseRef.current === 'recording') setPhase('locked');
        return;
      }
      if (phaseRef.current === 'idle') {
        // Let go before recording actually began: apply it as soon as it does.
        if (startingRef.current) pendingRef.current = action;
        return;
      }
      setPhase('idle');
      const durationMs = recorder.getStatus().durationMillis;
      let uri: string | null = null;
      try {
        await recorder.stop();
        uri = recorder.uri;
      } catch {
        uri = null;
      }
      void restoreUiAudioMode();
      const tooShort = durationMs < MIN_VOICE_MS;
      if (action === 'cancel' || !uri || tooShort) {
        if (uri) {
          try {
            new File(uri).delete();
          } catch {
            // The temporary file is cleaned up by the system anyway.
          }
        }
        if (action === 'send' && tooShort) callbacks.current.onTooShort();
        else feedback.recordCancel();
        return;
      }
      callbacks.current.onDone({
        uri,
        durationSec: Math.max(1, Math.round(durationMs / 1000)),
        waveform: waveformFromMetering(levelsRef.current, 40),
      });
    },
    [recorder, setPhase],
  );

  const begin = useCallback(async () => {
    if (phaseRef.current !== 'idle' || startingRef.current) return;
    startingRef.current = true;
    pendingRef.current = null;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        callbacks.current.onDenied();
        return;
      }
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
        allowsRecording: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      levelsRef.current = [];
      setLive([]);
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
      feedback.recordStart();
    } catch {
      void restoreUiAudioMode();
      callbacks.current.onDenied();
    } finally {
      startingRef.current = false;
    }
    const pending = pendingRef.current;
    if (pending && phaseRef.current !== 'idle') {
      pendingRef.current = null;
      void finish(pending);
    }
  }, [recorder, setPhase, finish]);

  // Collect levels for the waveform; stop and send at the length cap.
  useEffect(() => {
    if (phase === 'idle' || !state.isRecording) return;
    if (typeof state.metering === 'number') {
      levelsRef.current.push(state.metering);
      const level = state.metering;
      setLive((prev) => [...prev.slice(-47), level]);
    }
    if (state.durationMillis >= MAX_VOICE_MS) void finish('send');
  }, [state.durationMillis, state.metering, state.isRecording, phase, finish]);

  return { phase, durationMs: state.durationMillis, live, begin, finish, dragX, dragY };
}

export type VoiceNoteController = ReturnType<typeof useVoiceNote>;

/**
 * The mic button. Hold to record; the gesture stays mounted the whole time so sliding works.
 * A quick tap only shows a hint.
 */
export function MicButton({ voice, onHint, label }: { voice: VoiceNoteController; onHint: () => void; label: string }) {
  const recording = voice.phase === 'recording';
  const { dragX, dragY } = voice;
  const scale = useSharedValue(1);
  const ring = useSharedValue(0);
  const cancelArmed = useSharedValue(false);
  const lockArmed = useSharedValue(false);

  useEffect(() => {
    scale.value = withSpring(recording ? 1.35 : 1, { damping: 12, stiffness: 240 });
    ring.value = recording ? withRepeat(withTiming(1, { duration: 1000 }), -1, false) : withTiming(0, { duration: 120 });
  }, [recording, scale, ring]);

  const begin = () => void voice.begin();
  const finish = (action: Finish) => void voice.finish(action);
  const tick = () => feedback.select();

  const pan = Gesture.Pan()
    .activateAfterLongPress(180)
    .onStart(() => {
      runOnJS(begin)();
    })
    .onUpdate((e) => {
      dragX.value = e.translationX;
      dragY.value = e.translationY;
      const c = e.translationX <= CANCEL_DX;
      const l = e.translationY <= LOCK_DY;
      if (c !== cancelArmed.value) {
        cancelArmed.value = c;
        if (c) runOnJS(tick)();
      }
      if (l !== lockArmed.value) {
        lockArmed.value = l;
        if (l) runOnJS(tick)();
      }
    })
    .onEnd((e) => {
      const action: Finish = e.translationX <= CANCEL_DX ? 'cancel' : e.translationY <= LOCK_DY ? 'lock' : 'send';
      runOnJS(finish)(action);
    })
    .onFinalize((_e, success) => {
      cancelArmed.value = false;
      lockArmed.value = false;
      dragX.value = withSpring(0, { damping: 16, stiffness: 240 });
      dragY.value = withSpring(0, { damping: 16, stiffness: 240 });
      // Interrupted (call, system gesture): throw the recording away. A no-op when nothing was recording.
      if (!success) runOnJS(finish)('cancel');
    });

  const tap = Gesture.Tap().onEnd((_e, success) => {
    if (success) runOnJS(onHint)();
  });

  const gesture = Gesture.Exclusive(pan, tap);

  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 1], [0.35, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(ring.value, [0, 1], [1, 2.1], Extrapolation.CLAMP) }],
  }));
  const tokens = useTokens();

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', width: 46, height: 46, borderRadius: 23, backgroundColor: tokens.accent }, ringStyle]}
        />
        <Animated.View pointerEvents="none" style={buttonStyle}>
          <UIconButton tone="black" icon="mic" label={label} onPress={() => undefined} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Shown while recording in place of the + button and the text field. */
export function RecordingBar({
  voice,
  slideLabel,
  cancelLabel,
  onCancel,
}: {
  voice: VoiceNoteController;
  slideLabel: string;
  cancelLabel: string;
  onCancel: () => void;
}) {
  const tokens = useTokens();
  const locked = voice.phase === 'locked';
  const { dragX } = voice;
  const dot = useSharedValue(1);

  useEffect(() => {
    dot.value = withRepeat(withSequence(withTiming(0.25, { duration: 520 }), withTiming(1, { duration: 520 })), -1, false);
  }, [dot]);

  const cancelProgress = useAnimatedStyle(() => ({
    opacity: interpolate(dragX.value, [0, CANCEL_DX], [0, 1], Extrapolation.CLAMP),
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: dot.value * interpolate(dragX.value, [0, CANCEL_DX], [1, 0], Extrapolation.CLAMP),
  }));
  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragX.value, [0, CANCEL_DX], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(dragX.value, [CANCEL_DX, 0], [-48, 0], Extrapolation.CLAMP) }],
  }));

  const bars = waveformFromMetering(voice.live, 34);

  return (
    <View
      style={{
        flex: 1,
        height: 48,
        borderRadius: 24,
        backgroundColor: tokens['surface-2'],
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        gap: 10,
      }}
    >
      {locked ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          onPress={onCancel}
          hitSlop={8}
          style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="trash" size="md" color="ink" />
        </Pressable>
      ) : (
        <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.accent }, dotStyle]} />
          <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, cancelProgress]}>
            <Icon name="trash" size="md" color="ink" />
          </Animated.View>
        </View>
      )}
      <RNText style={{ fontFamily: FONT.sansSemi, fontSize: 15, color: tokens.ink, minWidth: 40 }}>
        {formatClock(voice.durationMs)}
      </RNText>
      {locked ? (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 28, overflow: 'hidden' }}>
          {bars.map((h, i) => (
            <View
              key={i}
              style={{ width: 2.5, height: Math.max(3, (h / 100) * 28), borderRadius: 1.25, backgroundColor: tokens.muted }}
            />
          ))}
        </View>
      ) : (
        <Animated.View style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }, hintStyle]}>
          <Icon name="back" size="sm" color="muted" />
          <RNText numberOfLines={1} style={{ fontFamily: FONT.sans, fontSize: 14, color: tokens.muted }}>
            {slideLabel}
          </RNText>
        </Animated.View>
      )}
    </View>
  );
}

/** The lock pill above the mic: follows the finger up and fills when it is armed. */
export function LockHint({ voice }: { voice: VoiceNoteController }) {
  const tokens = useTokens();
  const { dragY } = voice;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(dragY.value, [LOCK_DY, 0], [LOCK_DY * 0.6, 0], Extrapolation.CLAMP) }],
  }));
  const fill = useAnimatedStyle(() => ({
    opacity: interpolate(dragY.value, [0, LOCK_DY], [0, 1], Extrapolation.CLAMP),
  }));
  if (voice.phase !== 'recording') return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: 36,
          height: 76,
          borderRadius: 18,
          backgroundColor: tokens['surface-3'],
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 10,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: tokens.accent }, fill]} />
      <Icon name="lock" size="sm" color="ink" />
      <View style={{ transform: [{ rotate: '180deg' }] }}>
        <Icon name="chevronDown" size="sm" color="muted" />
      </View>
    </Animated.View>
  );
}
