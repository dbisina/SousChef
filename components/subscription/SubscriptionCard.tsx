import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSubscription, useRemainingUsage } from '@/hooks/useSubscription';
import { PremiumBadge } from './PremiumBadge';
import { UsageIndicator } from './UsageIndicator';
import { Muted, SectionLabel, UButton, UCard, Display } from '@/components/ui';

interface SubscriptionCardProps {
  onUpgradePress?: () => void;
  onManagePress?: () => void;
  showUsage?: boolean;
}

/** Black plan card (.card.k): plan name, status, usage bars and the upgrade / manage action. */
export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  onUpgradePress,
  onManagePress,
  showUsage = true,
}) => {
  const { t } = useTranslation();
  const { subscriptionTier, isSubscribed, tierName, openManagement } = useSubscription();
  const { remainingAI, remainingPortion } = useRemainingUsage();

  const handleManagePress = () => {
    if (onManagePress) {
      onManagePress();
    } else {
      openManagement();
    }
  };

  return (
    <UCard tone="black" style={{ gap: 14, borderRadius: 30, padding: 20 }}>
      <View style={{ gap: 8 }}>
        <SectionLabel>{t('account.sub.currentPlan', 'Current plan')}</SectionLabel>
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Display size={28}>{tierName}</Display>
          {isSubscribed ? <PremiumBadge tier={subscriptionTier} size="small" showIcon={false} /> : null}
        </View>
        <Muted small>
          {isSubscribed
            ? t('account.sub.active', 'Active subscription')
            : t('account.sub.freeStatus', 'Free plan')}
        </Muted>
      </View>

      {showUsage ? (
        <View style={{ gap: 14 }}>
          <UsageIndicator label={t('account.sub.aiSubs', 'AI Substitutions')} remaining={remainingAI} />
          <UsageIndicator label={t('account.sub.portion', 'Portion Analysis')} remaining={remainingPortion} />
        </View>
      ) : null}

      {isSubscribed ? (
        <UButton variant="ghost" label={t('account.sub.manage', 'Manage')} onPress={handleManagePress} />
      ) : (
        <UButton variant="accent" label={t('account.sub.upgrade', 'Upgrade')} onPress={onUpgradePress} />
      )}
    </UCard>
  );
};
