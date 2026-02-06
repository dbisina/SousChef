import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { RevenueCatUI, PAYWALL_RESULT } from '@/lib/revenuecat';
import { PurchasesOffering, PurchasesError } from 'react-native-purchases';

interface RevenueCatPaywallProps {
  offering?: PurchasesOffering;
  onPurchaseStarted?: () => void;
  onPurchaseCompleted?: () => void;
  onPurchaseError?: (error: PurchasesError) => void;
  onPurchaseCancelled?: () => void;
  onRestoreStarted?: () => void;
  onRestoreCompleted?: () => void;
  onRestoreError?: (error: PurchasesError) => void;
  onDismiss: () => void;
  customVariables?: Record<string, string>;
}

export const RevenueCatPaywall: React.FC<RevenueCatPaywallProps> = ({
  offering,
  onPurchaseStarted,
  onPurchaseCompleted,
  onPurchaseError,
  onPurchaseCancelled,
  onRestoreStarted,
  onRestoreCompleted,
  onRestoreError,
  onDismiss,
  customVariables,
}) => {
  const handlePurchaseStarted = useCallback(() => {
    onPurchaseStarted?.();
  }, [onPurchaseStarted]);

  const handlePurchaseCompleted = useCallback(() => {
    onPurchaseCompleted?.();
  }, [onPurchaseCompleted]);

  const handlePurchaseError = useCallback(
    ({ error }: { error: PurchasesError }) => {
      onPurchaseError?.(error);
    },
    [onPurchaseError]
  );

  const handlePurchaseCancelled = useCallback(() => {
    onPurchaseCancelled?.();
  }, [onPurchaseCancelled]);

  const handleRestoreStarted = useCallback(() => {
    onRestoreStarted?.();
  }, [onRestoreStarted]);

  const handleRestoreCompleted = useCallback(() => {
    onRestoreCompleted?.();
  }, [onRestoreCompleted]);

  const handleRestoreError = useCallback(
    ({ error }: { error: PurchasesError }) => {
      onRestoreError?.(error);
    },
    [onRestoreError]
  );

  const handleDismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  const paywallOptions = {
    ...(offering && { offering }),
    ...(customVariables && { customVariables }),
  };

  return (
    <View style={styles.container}>
      <RevenueCatUI.Paywall
        options={Object.keys(paywallOptions).length > 0 ? paywallOptions : undefined}
        onPurchaseStarted={handlePurchaseStarted}
        onPurchaseCompleted={handlePurchaseCompleted}
        onPurchaseError={handlePurchaseError}
        onPurchaseCancelled={handlePurchaseCancelled}
        onRestoreStarted={handleRestoreStarted}
        onRestoreCompleted={handleRestoreCompleted}
        onRestoreError={handleRestoreError}
        onDismiss={handleDismiss}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
