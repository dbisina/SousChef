import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FONT, Icon, ProgressBar, type IconName } from '@/components/ui';

interface UsageIndicatorProps {
  label: string;
  remaining: number | 'unlimited';
  limit?: number;
  icon?: IconName;
  showProgress?: boolean;
  compact?: boolean;
}

/** Usage row: label + "2 of 3" with a 6px progress bar (.bar). */
export const UsageIndicator: React.FC<UsageIndicatorProps> = ({
  label,
  remaining,
  limit,
  icon,
  showProgress = true,
  compact = false,
}) => {
  const { t } = useTranslation();
  const isUnlimited = remaining === 'unlimited';
  const remainingNum = isUnlimited ? 0 : remaining;
  const usedCount = limit ? limit - remainingNum : 0;
  const progress = limit ? Math.min(usedCount / limit, 1) : 0;
  const exhausted = !isUnlimited && remainingNum === 0;

  const valueText = isUnlimited
    ? t('account.usage.unlimited', 'Unlimited')
    : limit
      ? t('account.usage.ofLimit', '{{used}} of {{limit}}', { used: usedCount, limit })
      : t('account.usage.left', '{{n}} left', { n: remainingNum });

  if (compact) {
    return (
      <View className="flex-row items-center" style={{ gap: 4 }}>
        {icon ? <Icon name={icon} size="sm" color={exhausted ? 'tag-r-fg' : 'muted'} /> : null}
        <Text
          className={exhausted ? 'text-tag-r-fg' : 'text-ink'}
          style={{ fontFamily: FONT.sansMedium, fontSize: 13 }}
        >
          {isUnlimited ? '∞' : `${remaining}${limit ? `/${limit}` : ''}`}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
        <View className="flex-row items-center flex-1" style={{ gap: 6 }}>
          {icon ? <Icon name={icon} size="sm" color="muted" /> : null}
          <Text className="text-ink" style={{ fontFamily: FONT.sans, fontSize: 14 }}>
            {label}
          </Text>
        </View>
        <Text
          className={exhausted ? 'text-tag-r-fg' : 'text-ink'}
          style={{ fontFamily: FONT.sansMedium, fontSize: 14 }}
        >
          {valueText}
        </Text>
      </View>
      {showProgress && !isUnlimited && limit ? <ProgressBar value={progress} label={label} /> : null}
    </View>
  );
};

// Inline usage badge for showing remaining uses
interface UsageBadgeProps {
  remaining: number | 'unlimited';
  size?: 'small' | 'medium';
}

export const UsageBadge: React.FC<UsageBadgeProps> = ({ remaining, size = 'medium' }) => {
  const isUnlimited = remaining === 'unlimited';
  const remainingNum = isUnlimited ? 0 : remaining;

  const bg = isUnlimited
    ? 'bg-tag-g'
    : remainingNum === 0
      ? 'bg-tag-r'
      : remainingNum <= 2
        ? 'bg-tag-o'
        : 'bg-surface-3';
  const fg = isUnlimited
    ? 'text-tag-g-fg'
    : remainingNum === 0
      ? 'text-tag-r-fg'
      : remainingNum <= 2
        ? 'text-tag-o-fg'
        : 'text-ink';
  const h = size === 'small' ? 22 : 28;

  return (
    <View
      className={`items-center justify-center ${bg}`}
      style={{ height: h, minWidth: h, borderRadius: h / 2, paddingHorizontal: 8 }}
    >
      <Text className={fg} style={{ fontFamily: FONT.sansMedium, fontSize: size === 'small' ? 11 : 12 }}>
        {isUnlimited ? '∞' : remaining}
      </Text>
    </View>
  );
};
