import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription, usePremiumFeature } from '@/hooks/useSubscription';
import { SubscriptionTier } from '@/types/subscription';
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
  const { isPremium, isPro, subscriptionTier } = useSubscription();
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
      <TouchableOpacity
        onPress={() => setShowPaywall(true)}
        className="relative"
        activeOpacity={0.8}
      >
        <View className="opacity-50">{children}</View>
        <View className="absolute inset-0 items-center justify-center bg-black/20 rounded-xl">
          <View className="bg-white rounded-full p-3 shadow-lg">
            <Ionicons name="lock-closed" size={24} color="#FF6B35" />
          </View>
          <Text className="text-white font-semibold mt-2 text-center px-4">
            {feature || 'Premium Feature'}
          </Text>
          <Text className="text-white/80 text-sm">Tap to upgrade</Text>
        </View>
      </TouchableOpacity>

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
  icon?: keyof typeof Ionicons.glyphMap;
  className?: string;
}

export const LockedButton: React.FC<LockedButtonProps> = ({
  title,
  onPress,
  requiredTier = 'premium',
  feature,
  icon,
  className = '',
}) => {
  const { hasAccess, requireAccess, PaywallModal } = useFeatureGate({
    requiredTier,
    feature,
  });

  return (
    <>
      <TouchableOpacity
        onPress={() => requireAccess(onPress)}
        className={`flex-row items-center justify-center py-3 px-4 rounded-xl ${
          hasAccess ? 'bg-primary-500' : 'bg-neutral-200'
        } ${className}`}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={hasAccess ? 'white' : '#737373'}
            style={{ marginRight: 8 }}
          />
        )}
        <Text
          className={`font-semibold ${
            hasAccess ? 'text-white' : 'text-neutral-500'
          }`}
        >
          {title}
        </Text>
        {!hasAccess && (
          <Ionicons
            name="lock-closed"
            size={14}
            color="#737373"
            style={{ marginLeft: 8 }}
          />
        )}
      </TouchableOpacity>
      <PaywallModal />
    </>
  );
};
