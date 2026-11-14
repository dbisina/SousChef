import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useRecipeStore } from '@/stores/recipeStore';
import { useAuthStore } from '@/stores/authStore';
import {
  BarChart,
  FONT,
  H2,
  ListRow,
  Loading,
  Muted,
  ProgressBar,
  Rows,
  Screen,
  Segmented,
  Tag,
  Thumb,
  Tile,
  Title,
  TopBar,
} from '@/components/ui';
import { Recipe } from '@/types';

interface AnalyticsData {
  totalRecipes: number;
  totalViews: number;
  totalSaves: number;
  averageRating: number;
  topRecipes: Recipe[];
  categoryBreakdown: { category: string; count: number }[];
  recentActivity: { date: string; views: number; saves: number }[];
}

/** 5200 -> 5.2k, 32600 -> 32.6k */
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/.0$/, '')}k` : `${n}`);

export default function AnalyticsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { recipes } = useRecipeStore();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('month');

  useEffect(() => {
    calculateAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Monday-first week (M T W T F S S), like the design
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const recentActivity = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
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

  const title = t('account.analytics.title', 'Analytics');

  if (isLoading || !analytics) {
    return (
      <Screen bare>
        <TopBar variant="compact" title={title} onBack={() => router.back()} />
        <Loading fullScreen message={t('account.analytics.loading', 'Loading analytics...')} />
      </Screen>
    );
  }

  const maxViews = Math.max(...analytics.recentActivity.map((a) => a.views));
  const peak = analytics.recentActivity.findIndex((a) => a.views === maxViews);

  return (
    <Screen bare>
      <TopBar variant="compact" title={title} onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 14 }}>
        <View className="flex-row" style={{ gap: 12 }}>
          <View className="flex-1" style={{ gap: 12 }}>
            <Tile tone="black" labelFirst valueSize={28} value={compact(analytics.totalViews)} label={t('account.analytics.views', 'Total views')} />
            <Tile labelFirst valueSize={28} value={analytics.totalRecipes.toString()} label={t('account.analytics.recipes', 'Recipes')} />
          </View>
          <View className="flex-1" style={{ gap: 12 }}>
            <Tile labelFirst valueSize={28} value={analytics.totalSaves.toLocaleString()} label={t('account.analytics.saves', 'Saves')} />
            <Tile labelFirst valueSize={28} value={analytics.averageRating.toFixed(1)} label={t('account.analytics.rating', 'Avg rating')} />
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <View className="flex-row items-center justify-between">
            <Title>{t('account.analytics.viewsWeek', 'Views this week')}</Title>
            <Tag tone="g" label={t('account.analytics.up', 'Up')} />
          </View>
          <BarChart
            height={96}
            label={t('account.analytics.viewsWeek', 'Views this week')}
            data={analytics.recentActivity.map((a, i) => ({
              value: maxViews > 0 ? a.views / maxViews : 0,
              tone: i === peak ? ('ink' as const) : ('default' as const),
            }))}
          />
          <View className="flex-row" style={{ gap: 6 }}>
            {analytics.recentActivity.map((day, i) => (
              <Text
                key={i}
                className={i === peak ? 'text-ink' : 'text-muted'}
                style={{ flex: 1, textAlign: 'center', fontFamily: i === peak ? FONT.sansMedium : FONT.sans, fontSize: 12 }}
              >
                {day.date.slice(0, 1)}
              </Text>
            ))}
          </View>
        </View>

        {analytics.topRecipes.length > 0 ? (
          <>
            <H2>{t('account.analytics.top', 'Top recipes')}</H2>
            <Rows>
              {analytics.topRecipes.map((recipe) => (
                <ListRow
                  key={recipe.id}
                  leading={<Thumb source={recipe.imageURL ? { uri: recipe.imageURL } : undefined} name={recipe.title} size={52} />}
                  title={recipe.title}
                  subtitle={t('account.analytics.viewsOnly', '{{views}} views', { views: compact(recipe.views || 0) })}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                />
              ))}
            </Rows>
          </>
        ) : null}

        {analytics.categoryBreakdown.length > 0 ? (
          <>
            <H2>{t('account.analytics.categories', 'Category breakdown')}</H2>
            <View style={{ gap: 14 }}>
              {analytics.categoryBreakdown.map((item) => (
                <View key={item.category} style={{ gap: 8 }}>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-ink capitalize" style={{ fontFamily: FONT.sans, fontSize: 14 }}>
                      {item.category}
                    </Text>
                    <Muted>{item.count}</Muted>
                  </View>
                  <ProgressBar value={analytics.totalRecipes ? item.count / analytics.totalRecipes : 0} label={item.category} />
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Segmented<'week' | 'month' | 'all'>
          value={timeRange}
          onChange={setTimeRange}
          options={[
            { value: 'week', label: t('account.analytics.week', 'Week') },
            { value: 'month', label: t('account.analytics.month', 'Month') },
            { value: 'all', label: t('account.analytics.all', 'All Time') },
          ]}
        />
      </ScrollView>
    </Screen>
  );
}
