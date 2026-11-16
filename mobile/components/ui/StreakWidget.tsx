import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useGamificationStore } from '@/stores/gamificationStore';
import { useThemeColors } from '@/stores/themeStore';
import { LEVEL_NAMES } from '@/types/gamification';

export const StreakWidget: React.FC = () => {
  const colors = useThemeColors();
  const { getLevel, getStreak } = useGamificationStore();
  const level = getLevel();
  const streak = getStreak();

  return (
    <TouchableOpacity activeOpacity={0.9} className="mx-4 mb-4">
      <LinearGradient
        colors={streak.currentStreak >= 7 ? ['#F97316', '#EF4444'] : streak.currentStreak >= 3 ? ['#F59E0B', '#F97316'] : [colors.accent, colors.palette[400]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="rounded-2xl p-4"
      >
        <View className="flex-row items-center justify-between">
          {/* Streak */}
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center">
              <Ionicons name="flame" size={28} color="white" />
            </View>
            <View className="ml-3">
              <Text className="text-white/70 text-xs font-medium">COOKING STREAK</Text>
              <Text className="text-white text-2xl font-bold">
                {streak.currentStreak} {streak.currentStreak === 1 ? 'day' : 'days'}
              </Text>
            </View>
          </View>

          {/* Level / XP */}
          <View className="items-end">
            <Text className="text-white/70 text-xs font-medium">LEVEL {level.level}</Text>
            <Text className="text-white font-bold">{level.name}</Text>
            {/* XP progress bar */}
            <View className="w-20 h-1.5 bg-white/20 rounded-full mt-1.5 overflow-hidden">
              <View
                className="h-full bg-white rounded-full"
                style={{ width: `${Math.min(level.progress * 100, 100)}%` }}
              />
            </View>
            <Text className="text-white/50 text-[10px] mt-0.5">
              {level.xpToNext} XP to next
            </Text>
          </View>
        </View>

        {/* Motivational message */}
        {streak.currentStreak > 0 && (
          <View className="mt-3 bg-white/10 rounded-xl px-3 py-2">
            <Text className="text-white text-xs text-center">
              {streak.currentStreak >= 30
                ? "You're unstoppable! A whole month of cooking!"
                : streak.currentStreak >= 7
                  ? "One week strong! Keep this fire burning!"
                  : streak.currentStreak >= 3
                    ? "You're on a roll! Don't break the chain!"
                    : "Great start! Cook tomorrow to build your streak!"}
            </Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};
