import React from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { isDesignReview } from '@/lib/designReview';

/** Typical notched-iPhone insets. react-native-web reports 0, which would hide every safe-area-driven gap. */
const REVIEW_INSETS = { top: 44, bottom: 34, left: 0, right: 0 } as const;

/** Passes children through untouched unless design-review mode is on. */
export function DesignReviewFrame({ children }: { children: React.ReactNode }) {
  if (!isDesignReview) return <>{children}</>;
  return <SafeAreaInsetsContext.Provider value={REVIEW_INSETS}>{children}</SafeAreaInsetsContext.Provider>;
}
