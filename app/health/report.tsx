import React, { useMemo, useState } from 'react';
import { Share, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  CtaBar,
  ListRow,
  Muted,
  Rows,
  Screen,
  Segmented,
  Tag,
  Title,
  TopBar,
  UButton,
  UCard,
} from '@/components/ui';
import type { BarTone } from '@/components/ui/Indicators';
import { ValueTile } from '@/components/health/ValueTile';
import { GLUCOSE_CHART_MAX } from '@/components/health/format';
import { PREVIEW_LABEL } from '@/constants/features';
import { RANGE_DAYS, average, isGlucose } from '@/lib/health';
import { useAuthStore } from '@/stores/authStore';
import { doctorReport, useHealthStore } from '@/stores/healthStore';
import type { ReportRange } from '@/types/health';

const DAY_MS = 86_400_000;
const BARS = 10;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });

export default function DoctorReportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const readings = useHealthStore((s) => s.readings);
  const meals = useHealthStore((s) => s.meals);
  const [range, setRange] = useState<ReportRange>('30d');
  const now = useMemo(() => new Date(), []);

  const report = useMemo(() => doctorReport({ readings, meals }, range, now), [readings, meals, range, now]);
  const hasSample = useMemo(() => readings.some((r) => r.source === 'sample'), [readings]);

  const bars = useMemo(() => {
    const span = (RANGE_DAYS[range] * DAY_MS) / BARS;
    const start = now.getTime() - RANGE_DAYS[range] * DAY_MS;
    const glucose = readings.filter(isGlucose);
    return Array.from({ length: BARS }, (_, i) => {
      const from = start + i * span;
      const vals = glucose
        .filter((r) => {
          const ts = new Date(r.at).getTime();
          return ts > from && ts <= from + span;
        })
        .map((r) => r.mmol);
      return { value: vals.length ? average(vals) / GLUCOSE_CHART_MAX : 0, tone: (i === BARS - 1 ? 'ink' : 'default') as BarTone };
    });
  }, [readings, range, now]);

  const name = user?.displayName?.trim() || t('health.report.yourName', '[Your name]');
  const period = `${fmtDate(report.from)} – ${fmtDate(report.to)} ${new Date(report.to).getFullYear()}`;
  const bp = report.avgBp ? `${report.avgBp.systolic}/${report.avgBp.diastolic}` : '-';
  const summaryLine = [
    t('health.report.readings', '{{n}} readings', { n: report.glucoseReadings }),
    t('health.report.meals', '{{n}} meals logged', { n: report.mealsLogged }),
    report.highestRiseGroup
      ? t('health.report.highest', 'highest rises after {{group}}', { group: report.highestRiseGroup.toLowerCase() })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const share = () => {
    const text = [
      t('health.report.shareTitle', 'SousChef health summary'),
      `${name} · ${period} · ${report.condition}`,
      `${t('health.report.avgGlucose', 'Avg glucose')}: ${report.avgGlucose.toFixed(1)} mmol/L`,
      `${t('health.report.timeInRange', 'Time in range')}: ${report.timeInRangePct}%`,
      `${t('health.report.avgBp', 'Avg BP')}: ${bp}`,
      summaryLine,
    ].join('\n');
    Share.share({ message: text }).catch(() => undefined);
  };

  return (
    <Screen
      scroll
      bottomSpace={130}
      footer={
        <CtaBar>
          <UButton label={t('health.report.share', 'Share summary')} icon="share" onPress={share} />
        </CtaBar>
      }
    >
      <TopBar
        variant="compact"
        title={t('health.report.title', 'Doctor report')}
        onBack={() => router.back()}
        right={hasSample ? <Tag tone="o" label={PREVIEW_LABEL} /> : undefined}
      />

      <Segmented<ReportRange>
        value={range}
        onChange={setRange}
        options={[
          { value: '2w', label: t('health.report.r2w', '2 weeks') },
          { value: '30d', label: t('health.report.r30d', '30 days') },
          { value: '90d', label: t('health.report.r90d', '90 days') },
        ]}
      />

      <UCard tone="white" style={{ gap: 14, borderRadius: 28, padding: 20 }}>
        <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
          <View className="flex-1" style={{ minWidth: 0 }}>
            <Title numberOfLines={1}>{name}</Title>
            <Muted small>{`${period} · ${report.condition}`}</Muted>
          </View>
          <Image
            source={require('@/assets/icon.png')}
            accessibilityLabel="SousChef"
            style={{ width: 30, height: 30, borderRadius: 9 }}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ValueTile label={t('health.report.avgGlucose', 'Avg glucose')} value={report.glucoseReadings ? report.avgGlucose.toFixed(1) : '-'} />
          <ValueTile label={t('health.report.timeInRange', 'Time in range')} value={report.glucoseReadings ? `${report.timeInRangePct}%` : '-'} />
          <ValueTile label={t('health.report.avgBp', 'Avg BP')} value={bp} />
        </View>
        <BarChart data={bars} height={80} label={t('health.report.chart', 'Average glucose over the period')} />
        <Muted small>{summaryLine}</Muted>
      </UCard>

      <Rows>
        <ListRow
          icon="lock"
          title={t('health.report.numbersOnly', 'Numbers only')}
          subtitle={t('health.report.numbersOnlySub', 'Shared as a text summary from this device')}
        />
      </Rows>
    </Screen>
  );
}
