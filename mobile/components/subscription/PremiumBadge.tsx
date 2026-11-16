import React from 'react';
import { SubscriptionTier } from '@/types/subscription';
import { getTierDisplayName } from '@/services/subscriptionService';
import { Tag } from '@/components/ui';

interface PremiumBadgeProps {
  tier: SubscriptionTier;
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
}

/** Tier pill: Pro = black tag, Premium = orange tag. Free renders nothing. */
export const PremiumBadge: React.FC<PremiumBadgeProps> = ({
  tier,
  size = 'medium',
  showIcon = true,
}) => {
  if (tier === 'free') {
    return null;
  }

  return (
    <Tag
      label={getTierDisplayName(tier)}
      tone={tier === 'pro' ? 'k' : 'o'}
      icon={showIcon ? (tier === 'pro' ? 'award' : 'star') : undefined}
      large={size === 'large'}
    />
  );
};
