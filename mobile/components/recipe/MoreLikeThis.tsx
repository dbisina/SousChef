import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiEnabled } from '@/lib/api';
import { apiSimilarRecipes } from '@/services/recipeApi';
import type { Recipe } from '@/types';
import { RecipeRow } from './RecipeRow';

/** "More like this": dishes made of similar things, for the recipe being looked at. */
export function MoreLikeThis({ recipeId }: { recipeId: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Recipe[]>([]);
  useEffect(() => {
    if (!apiEnabled()) return;
    let live = true;
    apiSimilarRecipes(recipeId, 8)
      .then((r) => live && setItems(r))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [recipeId]);
  return <RecipeRow title={t('recipe.moreLikeThis', 'More like this')} recipes={items} />;
}
