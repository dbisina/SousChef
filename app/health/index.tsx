import React, { useMemo, useState } from 'react';
import { ScrollView, Text as RNText, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  FONT,
  H2,
  LinkText,
  ListRow,
  Muted,
  Rows,
  Screen,
  SectionLabel,
  Segmented,
  Tag,
  Thumb,
  Tile,
  TopBar,
  UCard,
  UIconButton,
} from '@/components/ui';
import type { BarTone } from '@/components/ui/Indicators';
import {
  GLUCOSE_CHART_MAX,
  STATUS_WORD,
  agoText,
  describeGlucose,
  glucoseBars,
  healthMealPhoto,
  timeText,
} from '@/components/health/format';
import { PREVIEW_LABEL } from '@/constants/features';
import { formatRise, glucoseStatus } from '@/lib/health';
import {
  latestBp,
  latestGlucose,
  latestLdl,
  mealResponse,
  readingStatus,
  useHealthStore,
} from '@/stores/healthStore';
import type { HealthPeriod } from '@/types/health';

const DAY_MS = 86_400_000;

export default function HealthScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const readings = useHealthStore((s) => s.readings);
  const meals = useHealthStore((s) => s.meals);
  const [period, setPeriod] = useState<HealthPeriod>('today');
  const now = useMemo(() => new Date(), []);

  const latest = useMemo(() => latestGlucose(readings, now), [readings, now]);
  const bp = useMemo(() => latestBp(readings), [readings]);
  const ldl = useMemo(() => latestLdl(readings), [readings]);
  const bars = useMemo(() => glucoseBars(readings, period, now), [readings, period, now]);
  const hasSample = useMemo(() => readings.some((r) => r.source === 'sample'), [readings]);

  const periodMeals = useMemo(() => {
    const start = new Date(now);
    if (period === 'today') start.setHours(0, 0, 0, 0);
    else start.setTime(now.getTime() - (period === 'week' ? 7 : 30) * DAY_MS);
    return meals
      .filter((m) => new Date(m.at).getTime() >= start.getTime() && new Date(m.at).getTime() <= now.getTime())
      .sort((a, b) => (period === 'today' ? a.at.localeCompare(b.at) : b.at.localeCompare(a.at)))
      .slice(0, 10);
  }, [meals, period, now]);

  const go = (href: string) => router.push(href as Href);
  const status = latest ? readingStatus(latest) : undefined;
  const maxIdx = bars.reduce((best, b, i) => (b.value > (bars[best]?.value ?? -1) ? i : best), 0);
  const chart = bars.map((b, i) => ({
    value: b.value / GLUCOSE_CHART_MAX,
    tone: (i === bars.length - 1 ? 'ink' : i === maxIdx ? 'accent' : 'default') as BarTone,
  }));
  const chartLabels = bars.length > 6 ? [bars[0], bars[Math.floor(bars.length / 2)], bars[bars.length - 1]] : bars;
  const mealsTitle =
    period === 'today'
      ? t('health.mealsToday', 'Meals today')
      : period === 'week'
        ? t('health.mealsWeek', 'Meals this week')
        : t('health.mealsMonth', 'Meals this month');

  return (
    <Screen bare>
      <TopBar
        title={t('health.title', 'Health')}
        onBack={() => router.back()}
        right={
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {hasSample ? <Tag tone="o" label={PREVIEW_LABEL} /> : null}
            <UIconButton icon="share" label={t('health.doctorReport', 'Doctor report')} onPress={() => go('/health/report')} />
            <UIconButton
              icon="plus"
              tone="black"
              label={t('health.logReading', 'Log a reading')}
              onPress={() => go('/health/log')}
            />
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <Segmented<HealthPeriod>
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'today', label: t('health.today', 'Today') },
            { value: 'week', label: t('health.week', 'Week') },
            { value: 'month', label: t('health.month', 'Month') },
          ]}
        />

        <UCard tone="black" style={{ gap: 14, borderRadius: 30, padding: 20 }}>
          <View className="flex-row items-center justify-between">
            <SectionLabel>{t('health.glucose', 'Blood glucose')}</SectionLabel>
            {status ? <Tag tone={status === 'in-range' ? 'g' : status === 'high' ? 'o' : 'r'} label={STATUS_WORD[status]} /> : null}
          </View>
          {latest ? (
            <View className="flex-row items-end justify-between" style={{ gap: 8 }}>
              <Text48 value={latest.mmol.toFixed(1)} unit="mmol/L" />
              <Muted small style={{ flexShrink: 1, textAlign: 'right' }}>
                {`${describeGlucose(latest, meals)} · ${timeText(latest.at)}`}
              </Muted>
            </View>
          ) : (
            <Muted>{t('health.noReadings', 'No readings yet. Tap + to log one.')}</Muted>
          )}
          {bars.length > 0 ? (
            <>
              <BarChart
                data={chart}
                height={70}
                label={t('health.chartLabel', 'Glucose readings, {{n}} values', { n: bars.length })}
              />
              <View className="flex-row justify-between">
                {chartLabels.map((b, i) => (
                  <Muted key={`${b.label}-${i}`} small>
                    {i === chartLabels.length - 1 && period === 'today' ? t('health.now', 'Now') : b.label}
                  </Muted>
                ))}
              </View>
            </>
          ) : null}
        </UCard>

        <View className="flex-row" style={{ gap: 12 }}>
          <View className="flex-1">
            <Tile
              value={bp ? `${bp.systolic}/${bp.diastolic}` : '—'}
              label={t('health.bp', 'Blood pressure')}
              onPress={() => go('/health/log')}
              accessibilityLabel={t('health.bp', 'Blood pressure')}
            >
              <Muted small>{bp ? agoText(bp.at, now) : t('health.noReading', 'No reading')}</Muted>
            </Tile>
          </View>
          <View className="flex-1">
            <Tile
              value={ldl ? ldl.ldl.toFixed(1) : '—'}
              label={t('health.ldl', 'LDL cholesterol')}
              onPress={() => go('/health/log')}
              accessibilityLabel={t('health.ldl', 'LDL cholesterol')}
            >
              <Muted small>{ldl ? `mmol/L · ${agoText(ldl.at, now)}` : t('health.noReading', 'No reading')}</Muted>
            </Tile>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <H2>{mealsTitle}</H2>
          {periodMeals.length > 0 ? (
            <LinkText onPress={() => go(`/health/meal/${periodMeals[0].id}`)}>{t('health.insights', 'Insights')}</LinkText>
          ) : null}
        </View>
        {periodMeals.length === 0 ? (
          <Muted>{t('health.noMeals', 'No meals logged in this period.')}</Muted>
        ) : (
          <Rows>
            {periodMeals.map((m) => {
              const resp = mealResponse({ readings, meals }, m.id);
              const after = resp?.after;
              const high = after ? glucoseStatus(after.mmol, after.timing) === 'high' : false;
              return (
                <ListRow
                  key={m.id}
                  onPress={() => go(`/health/meal/${m.id}`)}
                  title={m.title}
                  subtitle={`${m.mealType} · ${m.carbsG} g ${t('health.carbs', 'carbs')}`}
                  leading={<Thumb source={healthMealPhoto(m)} name={m.title} size={52} />}
                  right={resp?.rise != null ? <Tag tone={high ? 'o' : 'g'} label={formatRise(resp.rise)} /> : undefined}
                />
              );
            })}
          </Rows>
        )}
      </ScrollView>
    </Screen>
  );
}

function Text48({ value, unit }: { value: string; unit: string }) {
  return (
    <RNText className="text-ink" style={{ fontFamily: FONT.display, fontSize: 48, lineHeight: 50, letterSpacing: -1.44 }}>
      {value} <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 15, letterSpacing: 0 }}>{unit}</RNText>
    </RNText>
  );
}
