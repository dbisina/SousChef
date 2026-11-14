import React from 'react';
import { ScrollView, Share, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCookbook } from '@/hooks/useCookbooks';
import { useAuthStore } from '@/stores/authStore';
import { Recipe } from '@/types';
import {
  CtaBar,
  Display,
  H2,
  Icon,
  ListRow,
  Muted,
  PhotoCard,
  Screen,
  SectionLabel,
  SheetPanel,
  Tag,
  Thumb,
  UButton,
  UIconButton,
  Loading,
} from '@/components/ui';

export default function CookbookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { cookbook, recipes, isLoading, error, isSaved, toggleSave, handleLike } = useCookbook(id);

  const handleShare = async () => {
    if (!cookbook) return;
    try {
      await Share.share({
        message: t('cookbooks.curated.shareMessage', 'Check out this cookbook: {{title}}\n\nFrom SousChef App', {
          title: cookbook.title,
        }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleRecipePress = (recipe: Recipe) => {
    router.push(`/recipe/${recipe.id}`);
  };

  if (isLoading) {
    return <Loading fullScreen message={t('cookbooks.curated.loading', 'Loading cookbook...')} />;
  }

  if (error || !cookbook) {
    return (
      <Screen tone="dark" bare>
        <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 32, gap: 14 }}>
          <Icon name="warning" size="lg" color="muted" />
          <H2 center>{t('cookbooks.curated.notFound', 'Cookbook not found')}</H2>
          <Muted center>
            {error || t('cookbooks.curated.notFoundBody', "This cookbook doesn't exist or has been removed.")}
          </Muted>
          <UButton label={t('cookbooks.curated.goBack', 'Go back')} size="sm" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const topInset = Math.max(insets.top, 20) + 14;
  const difficultyLabel = (d: string) => t(`cookbooks.curated.difficulty_${d}`, d.charAt(0).toUpperCase() + d.slice(1));

  return (
    <Screen
      tone="dark"
      bare
      footer={
        user ? (
          <CtaBar fade>
            <UButton
              variant="ghost"
              icon="heart"
              label={String(cookbook.likes)}
              accessibilityLabel={t('cookbooks.curated.like', 'Like')}
              onPress={handleLike}
            />
            <UButton
              variant={isSaved ? 'ghost' : 'accent'}
              icon="bookmark"
              label={isSaved ? t('cookbooks.curated.saved', 'Saved') : t('cookbooks.curated.save', 'Save cookbook')}
              onPress={toggleSave}
            />
          </CtaBar>
        ) : null
      }
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: user ? 130 : 40 }} showsVerticalScrollIndicator={false}>
        <PhotoCard
          source={{ uri: cookbook.coverImageURL }}
          height={380}
          radius={0}
          fade="both"
          accessibilityLabel={cookbook.title}
        >
          <View
            className="flex-row items-center justify-between"
            style={{ position: 'absolute', top: topInset, left: 20, right: 20, zIndex: 2 }}
          >
            <UIconButton icon="back" tone="glassDark" label={t('common.back', 'Back')} onPress={() => router.back()} />
            <View className="flex-row" style={{ gap: 10 }}>
              <UIconButton icon="share" tone="glassDark" label={t('cookbooks.curated.share', 'Share')} onPress={handleShare} />
              {user ? (
                <UIconButton
                  icon="heart"
                  tone="glassDark"
                  label={t('cookbooks.curated.like', 'Like')}
                  onPress={handleLike}
                />
              ) : null}
            </View>
          </View>
          <View style={{ position: 'absolute', left: 22, right: 22, bottom: 54, gap: 8 }}>
            <SectionLabel>{t('cookbooks.curated.kicker', 'Curated cookbook')}</SectionLabel>
            <Display size={32} numberOfLines={3}>
              {cookbook.title}
            </Display>
            <Muted>
              {t('cookbooks.curated.meta', '{{recipes}} recipes · {{likes}} likes', {
                recipes: cookbook.recipeIds.length,
                likes: cookbook.likes,
              })}
            </Muted>
          </View>
        </PhotoCard>

        <SheetPanel gap={12}>
          {(cookbook.category || cookbook.description) && (
            <View style={{ gap: 10 }}>
              {cookbook.category ? <Tag tone="o" label={cookbook.category} /> : null}
              {cookbook.description ? <Muted>{cookbook.description}</Muted> : null}
            </View>
          )}

          {recipes.length === 0 ? (
            <View className="items-center" style={{ paddingVertical: 32, gap: 10 }}>
              <Icon name="kitchen" size="lg" color="muted" />
              <Muted center>{t('cookbooks.curated.empty', 'No recipes in this cookbook yet')}</Muted>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {recipes.map((recipe) => (
                <View key={recipe.id} style={{ minHeight: 76, justifyContent: 'center' }}>
                  <ListRow
                    title={recipe.title}
                    subtitle={`${t('cookbooks.curated.minutes', '{{n}} min', { n: recipe.prepTime + recipe.cookTime })} · ${difficultyLabel(String(recipe.difficulty))}`}
                    leading={<Thumb source={{ uri: recipe.imageURL }} name={recipe.title} size={68} />}
                    onPress={() => handleRecipePress(recipe)}
                  />
                </View>
              ))}
            </View>
          )}
        </SheetPanel>
      </ScrollView>
    </Screen>
  );
}
