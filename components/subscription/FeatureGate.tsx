import React, { useState, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionTier } from '@/types/subscription';
import { FONT, Icon, UButton, type IconName } from '@/components/ui';
import { FIXED } from '@/stores/themeStore';
import { Paywall } from './Paywall';

interface FeatureGateProps {
  children: React.ReactNode;
  requiredTier?: SubscriptionTier;
  feature?: string;
  fallback?: React.ReactNode;
  showLockOverlay?: boolean;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  children,
  requiredTier = 'premium',
  feature,
  fallback,
  showLockOverlay = true,
}) => {
  const { t } = useTranslation();
  const { isPremium, isPro } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);

  const hasAccess = (() => {
    if (requiredTier === 'free') return true;
    if (requiredTier === 'premium') return isPremium || isPro;
    if (requiredTier === 'pro') return isPro;
    return false;
  })();

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showLockOverlay) {
    return null;
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={feature || t('account.gate.premiumFeature', 'Premium Feature')}
        onPress={() => setShowPaywall(true)}
        style={{ position: 'relative' }}
      >
        <View style={{ opacity: 0.5 }}>{children}</View>
        <View
          className="items-center justify-center"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, gap: 6, backgroundColor: FIXED.scrim }}
        >
          <View className="items-center justify-center bg-paper" style={{ width: 46, height: 46, borderRadius: 23 }}>
            <Icon name="lock" color="night" />
          </View>
          <Text className="text-paper text-center px-4" style={{ fontFamily: FONT.display, fontSize: 15 }}>
            {feature || t('account.gate.premiumFeature', 'Premium Feature')}
          </Text>
          <Text className="text-paper" style={{ fontFamily: FONT.sans, fontSize: 12, opacity: 0.82 }}>
            {t('account.gate.tapToUpgrade', 'Tap to upgrade')}
          </Text>
        </View>
      </Pressable>

      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature={feature}
        requiredTier={requiredTier}
      />
    </>
  );
};

// Hook-based feature gate for programmatic access control
interface UseFeatureGateOptions {
  requiredTier?: SubscriptionTier;
  feature?: string;
}

export const useFeatureGate = (options: UseFeatureGateOptions = {}) => {
  const { requiredTier = 'premium', feature } = options;
  const { isPremium, isPro } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);

  const hasAccess = (() => {
    if (requiredTier === 'free') return true;
    if (requiredTier === 'premium') return isPremium || isPro;
    if (requiredTier === 'pro') return isPro;
    return false;
  })();

  const requireAccess = useCallback(
    (callback: () => void) => {
      if (hasAccess) {
        callback();
      } else {
        setShowPaywall(true);
      }
    },
    [hasAccess]
  );

  const closePaywall = useCallback(() => {
    setShowPaywall(false);
  }, []);

  const PaywallModal = useCallback(
    () => (
      <Paywall
        visible={showPaywall}
        onClose={closePaywall}
        feature={feature}
        requiredTier={requiredTier}
      />
    ),
    [showPaywall, closePaywall, feature, requiredTier]
  );

  return {
    hasAccess,
    requireAccess,
    showPaywall,
    setShowPaywall,
    closePaywall,
    PaywallModal,
  };
};

// Simple locked button component
interface LockedButtonProps {
  title: string;
  onPress: () => void;
  requiredTier?: SubscriptionTier;
  feature?: string;
  icon?: IconName;
}

export const LockedButton: React.FC<LockedButtonProps> = ({
  title,
  onPress,
  requiredTier = 'premium',
  feature,
  icon,
}) => {
  const { hasAccess, requireAccess, PaywallModal } = useFeatureGate({
    requiredTier,
    feature,
  });

  return (
    <>
      <UButton
        label={title}
        icon={hasAccess ? icon : 'lock'}
        variant={hasAccess ? 'primary' : 'ghost'}
        onPress={() => requireAccess(onPress)}
      />
      <PaywallModal />
    </>
  );
};
