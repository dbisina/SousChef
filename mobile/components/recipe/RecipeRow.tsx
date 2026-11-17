import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { H2, PhotoCard } from '@/components/ui';
import type { Recipe } from '@/types';

interface RecipeRowProps {
  title: string;
  recipes: Recipe[];
}

/** A heading and a row of recipe photos to swipe through; tapping one opens the recipe. Nothing when there are none. */
export function RecipeRow({ title, recipes }: RecipeRowProps) {
  const router = useRouter();
  if (recipes.length === 0) return null;
  return (
    <View style={{ gap: 12 }}>
      <H2>{title}</H2>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        {recipes.map((r) => (
          <PhotoCard
            key={r.id}
            source={r.imageURL ? { uri: r.imageURL } : null}
            width={170}
            height={210}
            radius={24}
            title={r.title}
            titleSize={15}
            captionInset={14}
            onPress={() => router.push(`/recipe/${r.id}` as Href)}
            accessibilityLabel={r.title}
          />
        ))}
      </ScrollView>
    </View>
  );
}
