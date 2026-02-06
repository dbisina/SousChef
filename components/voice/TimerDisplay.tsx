import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CookingTimer } from '@/types/voice';

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
  if (timers.length === 0) return null;

  // Get timer status color
  const getTimerColor = (timer: CookingTimer) => {
    if (timer.remainingSeconds <= 0) return '#22C55E'; // Completed - green
    if (timer.remainingSeconds <= 30) return '#EF4444'; // Under 30s - red
    if (timer.remainingSeconds <= 60) return '#F59E0B'; // Under 1min - amber
    return '#FF6B35'; // Normal - primary
  };

  // Get progress percentage
  const getProgress = (timer: CookingTimer) => {
    return ((timer.totalSeconds - timer.remainingSeconds) / timer.totalSeconds) * 100;
  };

  if (compact) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="py-2"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
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
    <View className="px-4 py-2">
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

// Compact timer pill for floating display
interface CompactTimerPillProps {
  timer: CookingTimer;
  formatTime: (seconds: number) => string;
  getColor: (timer: CookingTimer) => string;
  onPause: (timerId: string) => void;
  onResume: (timerId: string) => void;
  onRemove: (timerId: string) => void;
}

const CompactTimerPill: React.FC<CompactTimerPillProps> = ({
  timer,
  formatTime,
  getColor,
  onPause,
  onResume,
  onRemove,
}) => {
  const isComplete = timer.remainingSeconds <= 0;
  const color = getColor(timer);

  return (
    <View
      style={[styles.pill, { borderColor: color }]}
      className="flex-row items-center bg-white rounded-full px-3 py-1.5 shadow-sm"
    >
      {/* Timer icon */}
      <View
        style={{ backgroundColor: color }}
        className="w-6 h-6 rounded-full items-center justify-center mr-2"
      >
        <Ionicons
          name={isComplete ? 'checkmark' : 'timer-outline'}
          size={14}
          color="white"
        />
      </View>

      {/* Time display */}
      <Text style={{ color }} className="font-bold text-base mr-2">
        {isComplete ? 'Done!' : formatTime(timer.remainingSeconds)}
      </Text>

      {/* Timer name */}
      <Text className="text-neutral-500 text-xs mr-2" numberOfLines={1}>
        {timer.name}
      </Text>

      {/* Action buttons */}
      {!isComplete && (
        <TouchableOpacity
          onPress={() => timer.isRunning ? onPause(timer.id) : onResume(timer.id)}
          className="p-1"
        >
          <Ionicons
            name={timer.isRunning ? 'pause' : 'play'}
            size={16}
            color="#737373"
          />
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => onRemove(timer.id)} className="p-1">
        <Ionicons name="close" size={16} color="#737373" />
      </TouchableOpacity>
    </View>
  );
};

// Full timer card for list display
interface TimerCardProps {
  timer: CookingTimer;
  formatTime: (seconds: number) => string;
  getColor: (timer: CookingTimer) => string;
  getProgress: (timer: CookingTimer) => number;
  onPause: (timerId: string) => void;
  onResume: (timerId: string) => void;
  onRemove: (timerId: string) => void;
}

const TimerCard: React.FC<TimerCardProps> = ({
  timer,
  formatTime,
  getColor,
  getProgress,
  onPause,
  onResume,
  onRemove,
}) => {
  const isComplete = timer.remainingSeconds <= 0;
  const color = getColor(timer);
  const progress = getProgress(timer);

  return (
    <View className="bg-white rounded-xl p-4 mb-2 shadow-sm border border-neutral-100">
      <View className="flex-row items-center justify-between">
        {/* Left side: icon and info */}
        <View className="flex-row items-center flex-1">
          <View
            style={{ backgroundColor: color }}
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
          >
            <Ionicons
              name={isComplete ? 'checkmark' : 'timer-outline'}
              size={22}
              color="white"
            />
          </View>
          <View className="flex-1">
            <Text className="text-neutral-900 font-medium">{timer.name}</Text>
            <Text style={{ color }} className="text-2xl font-bold">
              {isComplete ? 'Complete!' : formatTime(timer.remainingSeconds)}
            </Text>
          </View>
        </View>

        {/* Right side: controls */}
        <View className="flex-row items-center">
          {!isComplete && (
            <TouchableOpacity
              onPress={() => timer.isRunning ? onPause(timer.id) : onResume(timer.id)}
              className="w-10 h-10 rounded-full bg-neutral-100 items-center justify-center mr-2"
            >
              <Ionicons
                name={timer.isRunning ? 'pause' : 'play'}
                size={20}
                color="#404040"
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => onRemove(timer.id)}
            className="w-10 h-10 rounded-full bg-neutral-100 items-center justify-center"
          >
            <Ionicons name="close" size={20} color="#404040" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress bar */}
      {!isComplete && (
        <View className="mt-3 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
          <View
            style={{ width: `${progress}%`, backgroundColor: color }}
            className="h-full rounded-full"
          />
        </View>
      )}
    </View>
  );
};

// Floating timer strip component
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FloatingTimerStripProps {
  timers: CookingTimer[];
  onPause: (timerId: string) => void;
  onResume: (timerId: string) => void;
  onRemove: (timerId: string) => void;
  formatTime: (seconds: number) => string;
}

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
    <View style={[styles.floatingContainer, { paddingTop: insets.top }]}>
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

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1.5,
  },
  floatingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 100,
  },
});
