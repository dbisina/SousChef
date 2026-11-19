import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiEnabled } from '@/lib/api';
import { apiBecauseYouCooked } from '@/services/recipeApi';
import type { Recipe } from '@/types';
import { RecipeRow } from './RecipeRow';

/** Home row: dishes like the one this person cooked or saved last. Nothing until they have. */
export function BecauseYouCooked({ signedIn }: { signedIn: boolean }) {
  const { t } = useTranslation();
  const [row, setRow] = useState<{ title: string; items: Recipe[] } | null>(null);
  useEffect(() => {
    if (!apiEnabled() || !signedIn) {
      setRow(null);
      return;
    }
    let live = true;
    apiBecauseYouCooked(8)
      .then((r) => live && setRow(r.basedOn ? { title: r.basedOn.title, items: r.items } : null))
      .catch(() => live && setRow(null));
    return () => {
      live = false;
    };
  }, [signedIn]);
  if (!row || row.items.length === 0) return null;
  return <RecipeRow title={t('home.becauseYouCooked', 'Because of {{title}}', { title: row.title })} recipes={row.items} />;
}
