import React, { useMemo } from 'react';
import { ScrollView, Text as RNText, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  FONT,
  Muted,
  PhotoCard,
  RatingTag,
  Rows,
  Screen,
  SectionLabel,
  SheetPanel,
  Tag,
  Title,
  TopBar,
  UIconButton,
} from '@/components/ui';
import type { RatingLevel } from '@/components/ui/Chips';
import { ValueTile } from '@/components/health/ValueTile';
import { dayText, healthMealPhoto, timeText } from '@/components/health/format';
import { FIXED } from '@/stores/themeStore';
import { formatRise, glucoseStatus } from '@/lib/health';
import { mealResponse, useHealthStore } from '@/stores/healthStore';
import type { Rating } from '@/types/order';

const LEVEL: Record<Rating['level'], RatingLevel> = { low: 'lo', medium: 'md', high: 'hi' };

export default function MealResponseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const readings = useHealthStore((s) => s.readings);
  const meals = useHealthStore((s) => s.meals);
  const resp = useMemo(() => mealResponse({ readings, meals }, String(id)), [readings, meals, id]);

  if (!resp) {
    return (
      <Screen>
        <TopBar variant="compact" title={t('health.meal.title', 'Meal response')} onBack={() => router.back()} />
        <Muted>{t('health.meal.notFound', 'This meal is no longer in your log.')}</Muted>
      </Screen>
    );
  }

  const { meal, before, after, rise, similar } = resp;
  const high = after ? glucoseStatus(after.mmol, after.timing) === 'high' : false;
  const afterLabel = after?.timing === '1h-after' ? t('health.meal.after1', '1 h after') : t('health.meal.after2', '2 h after');
  const noReading = t('health.meal.noReading', 'No reading');
  const ratings = meal.ratings
    ? ([
        ['sugars', t('health.meal.sugars', 'Sugars')],
        ['salt', t('health.meal.salt', 'Salt')],
        ['fat', t('health.meal.fat', 'Fat')],
      ] as const)
    : [];

  return (
    <Screen bare>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <PhotoCard
          source={healthMealPhoto(meal)}
          height={300}
          radius={0}
          fade="both"
          style={{ marginBottom: 0 }}
        >
          <View
            className="flex-row items-center justify-between"
            style={{ position: 'absolute', top: Math.max(insets.top, 20) + 14, left: 20, right: 20 }}
          >
            <UIconButton icon="back" tone="glassDark" label={t('health.meal.back', 'Back')} onPress={() => router.back()} />
            <Tag tone="glassDark" large label={`${meal.mealType} · ${dayText(meal.at)}`} />
          </View>
          <View style={{ position: 'absolute', left: 22, right: 22, bottom: 54, gap: 4, zIndex: 1 }}>
            <RNText numberOfLines={2} style={{ fontFamily: FONT.display, fontSize: 28, lineHeight: 32.2, letterSpacing: -0.56, color: FIXED.paper }}>
              {meal.title}
            </RNText>
            <RNText numberOfLines={2} style={{ fontFamily: FONT.sans, fontSize: 12, lineHeight: 17.4, color: FIXED.captionSub }}>
              {`${meal.portionLabel} · ${meal.carbsG} g ${t('health.carbs', 'carbs')}`}
            </RNText>
          </View>
        </PhotoCard>

        <SheetPanel>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ValueTile
              label={t('health.meal.before', 'Before')}
              value={before ? before.mmol.toFixed(1) : '-'}
              caption={before ? `mmol/L · ${timeText(before.at)}` : noReading}
            />
            <ValueTile
              label={afterLabel}
              value={after ? after.mmol.toFixed(1) : '-'}
              caption={after ? `mmol/L · ${timeText(after.at)}` : noReading}
              tone={high ? 'soft' : 'default'}
            />
            <ValueTile
              label={t('health.meal.rise', 'Rise')}
              value={rise != null ? formatRise(rise) : '-'}
              caption="mmol/L"
              tone="black"
            />
          </View>

          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            <RatingTag level="neutral" label={`${t('health.meal.carbs', 'Carbs')} ${meal.carbsG} g`} />
            {ratings.map(([key, label]) => {
              const r = meal.ratings?.[key];
              return r ? <RatingTag key={key} level={LEVEL[r.level]} label={`${label} ${r.word}`} /> : null;
            })}
          </View>

          {similar.length > 0 ? (
            <View style={{ gap: 8 }}>
              <SectionLabel>{t('health.meal.similar30', 'Similar meals · last 30 days')}</SectionLabel>
              <Rows box>
                {similar.map((s) => (
                  <View key={s.label} className="flex-row items-center" style={{ minHeight: 64, gap: 14 }}>
                    <View className="flex-1">
                      <Muted className="text-ink">
                        {t('health.meal.similarRow', '{{label}} · {{n}} meals', { label: s.label, n: s.meals })}
                      </Muted>
                    </View>
                    <Title>{t('health.meal.avg', 'avg {{n}}', { n: formatRise(s.avgRise) })}</Title>
                  </View>
                ))}
              </Rows>
            </View>
          ) : null}
        </SheetPanel>
      </ScrollView>
    </Screen>
  );
}
