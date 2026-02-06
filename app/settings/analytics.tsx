import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRecipeStore } from '@/stores/recipeStore';
import { useAuthStore } from '@/stores/authStore';
import { Card, Loading } from '@/components/ui';
import { Recipe } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnalyticsData {
  totalRecipes: number;
  totalViews: number;
  totalSaves: number;
  averageRating: number;
  topRecipes: Recipe[];
  categoryBreakdown: { category: string; count: number }[];
  recentActivity: { date: string; views: number; saves: number }[];
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { recipes } = useRecipeStore();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('month');

  useEffect(() => {
    calculateAnalytics();
  }, [recipes, timeRange]);

  const calculateAnalytics = () => {
    setIsLoading(true);

    // Filter recipes by the current user (for chefs/admins)
    const userRecipes = recipes.filter(
      (r) => r.authorId === user?.id || user?.role === 'admin'
    );

    // Calculate category breakdown
    const categoryMap = new Map<string, number>();
    userRecipes.forEach((recipe) => {
      const count = categoryMap.get(recipe.category) || 0;
      categoryMap.set(recipe.category, count + 1);
    });
    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    // Mock analytics data (in production, this would come from a backend)
    const totalViews = userRecipes.reduce((sum, r) => sum + (r.views || 0), 0);
    const totalSaves = userRecipes.reduce((sum, r) => sum + (r.saveCount || 0), 0);
    const ratings = userRecipes.filter((r) => r.rating).map((r) => r.rating || 0);
    const averageRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

    // Top recipes by views
    const topRecipes = [...userRecipes]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5);

    // Mock recent activity
    const recentActivity = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return {
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        views: Math.floor(Math.random() * 100) + 10,
        saves: Math.floor(Math.random() * 20) + 1,
      };
    });

    setAnalytics({
      totalRecipes: userRecipes.length,
      totalViews,
      totalSaves,
      averageRating,
      topRecipes,
      categoryBreakdown,
      recentActivity,
    });
    setIsLoading(false);
  };

  if (isLoading || !analytics) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
        <View className="flex-row items-center px-4 py-3 border-b border-neutral-100 bg-white">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <Ionicons name="arrow-back" size={24} color="#404040" />
          </TouchableOpacity>
          <Text className="flex-1 text-lg font-bold text-neutral-900 ml-2">
            Recipe Analytics
          </Text>
        </View>
        <Loading fullScreen message="Loading analytics..." />
      </SafeAreaView>
    );
  }

  const maxViews = Math.max(...analytics.recentActivity.map((a) => a.views));

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-100 bg-white">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#404040" />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-neutral-900 ml-2">
          Recipe Analytics
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Time Range Selector */}
          <View className="flex-row bg-neutral-200 rounded-xl p-1 mb-6">
            {(['week', 'month', 'all'] as const).map((range) => (
              <TouchableOpacity
                key={range}
                onPress={() => setTimeRange(range)}
                className={`flex-1 py-2 rounded-lg ${
                  timeRange === range ? 'bg-white' : ''
                }`}
              >
                <Text
                  className={`text-center font-medium ${
                    timeRange === range ? 'text-neutral-900' : 'text-neutral-500'
                  }`}
                >
                  {range === 'week' ? 'Week' : range === 'month' ? 'Month' : 'All Time'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Stats Grid */}
          <View className="flex-row flex-wrap -mx-1 mb-6">
            <StatCard
              icon="restaurant"
              label="Total Recipes"
              value={analytics.totalRecipes.toString()}
              color="#FF6B35"
            />
            <StatCard
              icon="eye"
              label="Total Views"
              value={analytics.totalViews.toLocaleString()}
              color="#3B82F6"
            />
            <StatCard
              icon="bookmark"
              label="Total Saves"
              value={analytics.totalSaves.toLocaleString()}
              color="#22C55E"
            />
            <StatCard
              icon="star"
              label="Avg Rating"
              value={analytics.averageRating.toFixed(1)}
              color="#F59E0B"
            />
          </View>

          {/* Activity Chart */}
          <Text className="text-sm font-medium text-neutral-500 uppercase mb-3">
            Views This Week
          </Text>
          <Card className="mb-6">
            <View className="flex-row items-end justify-between h-32">
              {analytics.recentActivity.map((day, index) => (
                <View key={index} className="items-center flex-1">
                  <View
                    className="w-8 bg-primary-500 rounded-t-lg"
                    style={{
                      height: `${(day.views / maxViews) * 100}%`,
                      minHeight: 4,
                    }}
                  />
                  <Text className="text-xs text-neutral-500 mt-2">{day.date}</Text>
                </View>
              ))}
            </View>
          </Card>

          {/* Top Recipes */}
          {analytics.topRecipes.length > 0 && (
            <>
              <Text className="text-sm font-medium text-neutral-500 uppercase mb-3">
                Top Performing Recipes
              </Text>
              <Card padding="none" className="mb-6">
                {analytics.topRecipes.map((recipe, index) => (
                  <TouchableOpacity
                    key={recipe.id}
                    onPress={() => router.push(`/recipe/${recipe.id}`)}
                    className={`flex-row items-center px-4 py-3 ${
                      index < analytics.topRecipes.length - 1 ? 'border-b border-neutral-100' : ''
                    }`}
                  >
                    <Text className="w-6 text-lg font-bold text-neutral-400">
                      {index + 1}
                    </Text>
                    <View className="flex-1 ml-2">
                      <Text className="font-medium text-neutral-900" numberOfLines={1}>
                        {recipe.title}
                      </Text>
                      <Text className="text-sm text-neutral-500">
                        {recipe.views || 0} views • {recipe.saveCount || 0} saves
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#A3A3A3" />
                  </TouchableOpacity>
                ))}
              </Card>
            </>
          )}

          {/* Category Breakdown */}
          {analytics.categoryBreakdown.length > 0 && (
            <>
              <Text className="text-sm font-medium text-neutral-500 uppercase mb-3">
                Category Breakdown
              </Text>
              <Card>
                {analytics.categoryBreakdown.map((item, index) => (
                  <View
                    key={item.category}
                    className={`flex-row items-center justify-between ${
                      index > 0 ? 'mt-3' : ''
                    }`}
                  >
                    <View className="flex-row items-center flex-1">
                      <Text className="text-neutral-700 capitalize">{item.category}</Text>
                    </View>
                    <View className="flex-row items-center">
                      <View
                        className="h-2 bg-primary-500 rounded-full mr-2"
                        style={{
                          width: (item.count / analytics.totalRecipes) * 100,
                          maxWidth: 100,
                          minWidth: 20,
                        }}
                      />
                      <Text className="text-neutral-500 w-8 text-right">{item.count}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => (
  <View className="w-1/2 p-1">
    <Card>
      <View className="flex-row items-center">
        <View
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View className="ml-3">
          <Text className="text-xl font-bold text-neutral-900">{value}</Text>
          <Text className="text-xs text-neutral-500">{label}</Text>
        </View>
      </View>
    </Card>
  </View>
);
