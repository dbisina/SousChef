import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useRecipeStore } from '@/stores/recipeStore';
import { useAuthStore } from '@/stores/authStore';
import type { Recipe } from '@/types';
import { BarChart, FONT, H2, ListRow, Muted, ProgressBar, Rows, Screen, Thumb, Tile, Title, TopBar } from '@/components/ui';

/** 5200 -> 5.2k, 32600 -> 32.6k */
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${n}`);

/** What people have done with the recipes you wrote: the real counts the server keeps, nothing estimated. */
export default function AnalyticsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const fetchUserRecipes = useRecipeStore((s) => s.fetchUserRecipes);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  useEffect(() => {
    if (user) fetchUserRecipes(user.id).then(setRecipes).catch(() => setRecipes([]));
  }, [user, fetchUserRecipes]);

  const stats = useMemo(() => {
    const mine = recipes;
    const categories = new Map<string, number>();
    for (const r of mine) categories.set(r.category, (categories.get(r.category) ?? 0) + 1);
    const rated = mine.filter((r) => (r.ratingCount ?? 0) > 0 && r.rating);
    const ratingSum = rated.reduce((sum, r) => sum + (r.rating ?? 0) * (r.ratingCount ?? 0), 0);
    const ratingCount = rated.reduce((sum, r) => sum + (r.ratingCount ?? 0), 0);
    const byEngagement = [...mine].sort((a, b) => (b.likes ?? 0) + (b.saveCount ?? 0) - ((a.likes ?? 0) + (a.saveCount ?? 0)));
    return {
      total: mine.length,
      likes: mine.reduce((sum, r) => sum + (r.likes ?? 0), 0),
      saves: mine.reduce((sum, r) => sum + (r.saveCount ?? 0), 0),
      comments: mine.reduce((sum, r) => sum + (r.commentCount ?? 0), 0),
      rating: ratingCount > 0 ? ratingSum / ratingCount : 0,
      top: byEngagement.slice(0, 5),
      categories: [...categories.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    };
  }, [recipes]);

  const title = t('account.analytics.title', 'Analytics');
  const max = Math.max(1, ...stats.top.map((r) => (r.likes ?? 0) + (r.saveCount ?? 0)));

  return (
    <Screen bare>
      <TopBar variant="compact" title={title} onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 14 }}>
        {stats.total === 0 ? (
          <Muted center style={{ paddingVertical: 40 }}>
            {t('account.analytics.empty', 'Once you share a recipe, how people respond to it shows up here.')}
          </Muted>
        ) : (
          <>
            <View className="flex-row" style={{ gap: 12 }}>
              <View className="flex-1" style={{ gap: 12 }}>
                <Tile tone="black" labelFirst valueSize={28} value={compact(stats.likes)} label={t('account.analytics.likes', 'Likes')} />
                <Tile labelFirst valueSize={28} value={stats.total.toString()} label={t('account.analytics.recipes', 'Recipes')} />
              </View>
              <View className="flex-1" style={{ gap: 12 }}>
                <Tile labelFirst valueSize={28} value={compact(stats.saves)} label={t('account.analytics.saves', 'Saves')} />
                <Tile labelFirst valueSize={28} value={stats.rating > 0 ? stats.rating.toFixed(1) : '–'} label={t('account.analytics.rating', 'Avg rating')} />
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Title>{t('account.analytics.perRecipe', 'Likes and saves per recipe')}</Title>
              <BarChart
                height={96}
                label={t('account.analytics.perRecipe', 'Likes and saves per recipe')}
                data={stats.top.map((r, i) => ({ value: ((r.likes ?? 0) + (r.saveCount ?? 0)) / max, tone: i === 0 ? ('ink' as const) : ('default' as const) }))}
              />
            </View>

            <H2>{t('account.analytics.top', 'Top recipes')}</H2>
            <Rows>
              {stats.top.map((recipe) => (
                <ListRow
                  key={recipe.id}
                  leading={<Thumb source={recipe.imageURL ? { uri: recipe.imageURL } : undefined} name={recipe.title} size={52} />}
                  title={recipe.title}
                  subtitle={t('account.analytics.engagement', '{{likes}} likes · {{saves}} saves', { likes: compact(recipe.likes ?? 0), saves: compact(recipe.saveCount ?? 0) })}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                />
              ))}
            </Rows>

            <H2>{t('account.analytics.categories', 'Category breakdown')}</H2>
            <View style={{ gap: 14 }}>
              {stats.categories.map((item) => (
                <View key={item.category} style={{ gap: 8 }}>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-ink capitalize" style={{ fontFamily: FONT.sans, fontSize: 14 }}>
                      {item.category}
                    </Text>
                    <Muted>{item.count}</Muted>
                  </View>
                  <ProgressBar value={stats.total ? item.count / stats.total : 0} label={item.category} />
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
