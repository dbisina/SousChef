import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CookingTimer } from '@/types/voice';
import { Icon, ProgressBar, useTokens, FONT } from '@/components/ui';

interface TimerDisplayProps {
  timers: CookingTimer[];
  onPause: (timerId: string) => void;
  onResume: (timerId: string) => void;
  onRemove: (timerId: string) => void;
  formatTime: (seconds: number) => string;
  compact?: boolean;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  timers,
  onPause,
  onResume,
  onRemove,
  formatTime,
  compact = false,
}) => {
  const tokens = useTokens();
  if (timers.length === 0) return null;

  // Timer status color: accent normally, urgent as time runs out, ink when done
  const getTimerColor = (timer: CookingTimer) => {
    if (timer.remainingSeconds <= 0) return tokens['rating-lo-dot'];
    if (timer.remainingSeconds <= 30) return tokens['rating-hi-dot'];
    return tokens.accent;
  };

  const getProgress = (timer: CookingTimer) => (timer.totalSeconds - timer.remainingSeconds) / timer.totalSeconds;

  if (compact) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8, gap: 8 }}
      >
        {timers.map((timer) => (
          <CompactTimerPill
            key={timer.id}
            timer={timer}
            formatTime={formatTime}
            getColor={getTimerColor}
            onPause={onPause}
            onResume={onResume}
            onRemove={onRemove}
          />
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 8 }}>
      {timers.map((timer) => (
        <TimerCard
          key={timer.id}
          timer={timer}
          formatTime={formatTime}
          getColor={getTimerColor}
          getProgress={getProgress}
          onPause={onPause}
          onResume={onResume}
          onRemove={onRemove}
        />
      ))}
    </View>
  );
};

interface TimerItemProps {
  timer: CookingTimer;
  formatTime: (seconds: number) => string;
  getColor: (timer: CookingTimer) => string;
  onPause: (timerId: string) => void;
  onResume: (timerId: string) => void;
  onRemove: (timerId: string) => void;
}

// Compact timer pill for the floating strip
const CompactTimerPill: React.FC<TimerItemProps> = ({ timer, formatTime, getColor, onPause, onResume, onRemove }) => {
  const { t } = useTranslation();
  const isComplete = timer.remainingSeconds <= 0;
  const color = getColor(timer);

  return (
    <View className="flex-row items-center bg-surface-3" style={{ height: 44, borderRadius: 22, paddingStart: 14, paddingEnd: 4, gap: 8 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
        {isComplete ? t('cooking.timerDone', 'Done!') : formatTime(timer.remainingSeconds)}
      </Text>
      <Text className="text-muted" numberOfLines={1} style={{ fontFamily: FONT.sans, fontSize: 12, maxWidth: 90 }}>
        {timer.name}
      </Text>

      {!isComplete ? (
        <Pressable
          onPress={() => (timer.isRunning ? onPause(timer.id) : onResume(timer.id))}
          accessibilityRole="button"
          accessibilityLabel={timer.isRunning ? t('cooking.pauseTimer', 'Pause timer') : t('cooking.resumeTimer', 'Resume timer')}
          className="items-center justify-center"
          style={{ width: 36, height: 36 }}
          hitSlop={4}
        >
          <Icon name={timer.isRunning ? 'minus' : 'play'} size="sm" color="muted" />
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => onRemove(timer.id)}
        accessibilityRole="button"
        accessibilityLabel={t('cooking.removeTimer', 'Remove timer')}
        className="items-center justify-center"
        style={{ width: 36, height: 36 }}
        hitSlop={4}
      >
        <Icon name="close" size="sm" color="muted" />
      </Pressable>
    </View>
  );
};

// Full timer card for list display
const TimerCard: React.FC<TimerItemProps & { getProgress: (timer: CookingTimer) => number }> = ({
  timer,
  formatTime,
  getColor,
  getProgress,
  onPause,
  onResume,
  onRemove,
}) => {
  const { t } = useTranslation();
  const isComplete = timer.remainingSeconds <= 0;
  const color = getColor(timer);

  return (
    <View className="bg-surface" style={{ borderRadius: 28, padding: 18, gap: 12 }}>
      <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
        <View className="flex-1" style={{ gap: 2 }}>
          <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
            {timer.name}
          </Text>
          <Text style={{ fontFamily: FONT.display, fontSize: 28, letterSpacing: -0.56, color }}>
            {isComplete ? t('cooking.timerComplete', 'Complete!') : formatTime(timer.remainingSeconds)}
          </Text>
        </View>

        <View className="flex-row items-center" style={{ gap: 8 }}>
          {!isComplete ? (
            <Pressable
              onPress={() => (timer.isRunning ? onPause(timer.id) : onResume(timer.id))}
              accessibilityRole="button"
              accessibilityLabel={timer.isRunning ? t('cooking.pauseTimer', 'Pause timer') : t('cooking.resumeTimer', 'Resume timer')}
              className="items-center justify-center bg-surface-3"
              style={{ width: 44, height: 44, borderRadius: 22 }}
            >
              <Icon name={timer.isRunning ? 'minus' : 'play'} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => onRemove(timer.id)}
            accessibilityRole="button"
            accessibilityLabel={t('cooking.removeTimer', 'Remove timer')}
            className="items-center justify-center bg-surface-3"
            style={{ width: 44, height: 44, borderRadius: 22 }}
          >
            <Icon name="close" />
          </Pressable>
        </View>
      </View>

      {!isComplete ? <ProgressBar value={getProgress(timer)} variant="accent" /> : null}
    </View>
  );
};

interface FloatingTimerStripProps {
  timers: CookingTimer[];
  onPause: (timerId: string) => void;
  onResume: (timerId: string) => void;
  onRemove: (timerId: string) => void;
  formatTime: (seconds: number) => string;
}

// Floating timer strip pinned under the status bar
export const FloatingTimerStrip: React.FC<FloatingTimerStripProps> = ({
  timers,
  onPause,
  onResume,
  onRemove,
  formatTime,
}) => {
  const insets = useSafeAreaInsets();

  if (timers.length === 0) return null;

  return (
    <View
      className="bg-ground border-divider"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top, borderBottomWidth: 1, zIndex: 100 }}
    >
      <TimerDisplay
        timers={timers}
        onPause={onPause}
        onResume={onResume}
        onRemove={onRemove}
        formatTime={formatTime}
        compact
      />
    </View>
  );
};
