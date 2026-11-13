import React from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SAMPLE } from '@/assets/sample';
import {
  Icon,
  Muted,
  PhotoCard,
  ProgressBar,
  Tag,
  Tile,
  Title,
  UAvatar,
  UCard,
  FONT,
} from '@/components/ui';
import {
  WasteStats as WasteStatsType,
  FoodWasteEntry,
  WasteReason,
  WASTE_REASON_LABELS,
} from '@/types/mealplan';
import { FIXED } from '@/stores/themeStore';
import { foodPhoto } from './foodPhoto';

interface WasteStatsProps {
  stats: WasteStatsType | null;
}

/** Hero photo card (this month's waste) plus the "Top reason" and "Most wasted" tiles. Design: Waste.html. */
export const WasteStatsCard: React.FC<WasteStatsProps> = ({ stats }) => {
  const { t } = useTranslation();

  if (!stats) {
    return (
      <UCard>
        <View className="items-center" style={{ paddingVertical: 12, gap: 8 }}>
          <Icon name="leaf" size="lg" color="subtle" />
          <Title>{t('planWaste.noData', 'No waste data yet')}</Title>
          <Muted small center>
            {t('planWaste.noDataHint', 'Start tracking your food waste to see insights')}
          </Muted>
        </View>
      </UCard>
    );
  }

  const reasons = Object.entries(stats.wasteByReason).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const topReason = reasons[0]?.[0] as WasteReason | undefined;
  const topItem = stats.topWastedItems[0]?.name;
  const trend =
    stats.trendDirection === 'improving'
      ? t('planWaste.trendDown', 'down from last month')
      : stats.trendDirection === 'worsening'
        ? t('planWaste.trendUp', 'up from last month')
        : t('planWaste.trendFlat', 'steady this month');
  const dash = '—';

  return (
    <View style={{ gap: 16 }}>
      <PhotoCard
        source={SAMPLE.spinach}
        height={200}
        topLeft={<Tag large tone="glassDark" label={t('planWaste.thisMonth', 'This month')} />}
      >
        <View style={{ position: 'absolute', left: 18, right: 18, bottom: 16, gap: 4, zIndex: 1 }}>
          <RNText style={{ fontFamily: FONT.sans, fontSize: 12, color: FIXED.captionSub }}>
            {t('planWaste.wasted', 'Wasted')}
          </RNText>
          <RNText
            accessibilityLabel={`$${stats.wastedThisMonth.toFixed(2)}`}
            style={{ fontFamily: FONT.display, fontSize: 40, lineHeight: 40, letterSpacing: -0.8, color: FIXED.paper }}
          >
            ${stats.wastedThisMonth.toFixed(2)}
          </RNText>
          <RNText style={{ fontFamily: FONT.sans, fontSize: 12, color: FIXED.captionSub }}>
            {t('planWaste.itemsTrend', '{{n}} items · {{trend}}', { n: stats.itemsWastedThisMonth, trend })}
          </RNText>
        </View>
      </PhotoCard>
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="flex-1">
          <Tile
            label={t('planWaste.topReason', 'Top reason')}
            value={topReason ? WASTE_REASON_LABELS[topReason] : dash}
          />
        </View>
        <View className="flex-1">
          <Tile label={t('planWaste.mostWasted', 'Most wasted')} value={topItem ?? dash} />
        </View>
      </View>
    </View>
  );
};

interface SavingsDisplayProps {
  savedByPlanning: number;
  expiringItemsUsed: number;
}

/** Compact "saved by planning" line for the meal plan screen. */
export const SavingsDisplay: React.FC<SavingsDisplayProps> = ({ savedByPlanning, expiringItemsUsed }) => {
  const { t } = useTranslation();
  return (
    <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
      <Tag
        tone="g"
        icon="leaf"
        label={t('plan.saved', '${{amt}} saved', { amt: savedByPlanning.toFixed(2) })}
      />
      {expiringItemsUsed > 0 ? (
        <Tag
          tone="o"
          label={t('plan.expiringUsed', '{{n}} expiring items used', { n: expiringItemsUsed })}
        />
      ) : null}
    </View>
  );
};

interface WasteEntryRowProps {
  entry: FoodWasteEntry;
  onDelete?: () => void;
}

/** Recent-waste row: photo, name, "2 cups · Expired", cost. */
export const WasteEntryRow: React.FC<WasteEntryRowProps> = ({ entry, onDelete }) => {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center" style={{ minHeight: 64, gap: 14 }}>
      <UAvatar name={entry.itemName} source={foodPhoto(entry.itemName)} size={44} />
      <View className="flex-1" style={{ minWidth: 0, gap: 2 }}>
        <Title numberOfLines={1}>{entry.itemName}</Title>
        <Muted small numberOfLines={1}>
          {`${entry.amount} ${entry.unit} · ${WASTE_REASON_LABELS[entry.reason]}`}
        </Muted>
      </View>
      <RNText className="text-ink" style={{ fontFamily: FONT.sansSemi, fontSize: 14 }}>
        ${entry.estimatedValue.toFixed(2)}
      </RNText>
      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('planWaste.deleteEntry', 'Delete {{name}}', { name: entry.itemName })}
          onPress={onDelete}
          className="items-center justify-center"
          style={({ pressed }) => ({ width: 44, height: 44, marginRight: -10, opacity: pressed ? 0.6 : 1 })}
        >
          <Icon name="trash" color="subtle" />
        </Pressable>
      ) : null}
    </View>
  );
};

interface WasteBreakdownProps {
  wasteByReason: Record<WasteReason, number>;
}

/** Waste by reason as labelled progress bars. */
export const WasteBreakdown: React.FC<WasteBreakdownProps> = ({ wasteByReason }) => {
  const { t } = useTranslation();
  const total = Object.values(wasteByReason).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const reasons = Object.entries(wasteByReason)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <View style={{ gap: 12 }}>
      <Title>{t('planWaste.byReason', 'Waste by reason')}</Title>
      {reasons.map(([reason, count]) => {
        const pct = Math.round((count / total) * 100);
        return (
          <View key={reason} style={{ gap: 6 }}>
            <View className="flex-row justify-between">
              <Muted small>{WASTE_REASON_LABELS[reason as WasteReason]}</Muted>
              <Muted small>{`${count} (${pct}%)`}</Muted>
            </View>
            <ProgressBar value={pct / 100} variant="accent" label={WASTE_REASON_LABELS[reason as WasteReason]} />
          </View>
        );
      })}
    </View>
  );
};
