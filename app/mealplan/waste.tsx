import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useWasteTracking } from '@/hooks/useMealPlan';
import { WasteStatsCard, WasteEntryRow, WasteBreakdown } from '@/components/mealplan';
import {
  Chip,
  CtaBar,
  Field,
  H2,
  Icon,
  Muted,
  Rows,
  Screen,
  Tag,
  Title,
  TopBar,
  UButton,
  UCard,
  UIconButton,
} from '@/components/ui';
import { Loading } from '@/components/ui/Loading';
import { Paywall } from '@/components/subscription';
import { WasteReason, WasteEntryFormData, WASTE_REASON_LABELS } from '@/types/mealplan';
import { showErrorToast, showInfoToast } from '@/stores/toastStore';

export default function WasteTrackingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { wasteLog, wasteStats, isLoading, canTrack, logWaste, deleteWaste } = useWasteTracking();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // Form state
  const [itemName, setItemName] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('piece');
  const [reason, setReason] = useState<WasteReason>('expired');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogWaste = async () => {
    if (!itemName.trim()) {
      showInfoToast(t('planWaste.needName', 'What item are we logging today?'), t('planWaste.missingInfo', 'Missing Info'));
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      showInfoToast(
        t('planWaste.needAmount', 'How much was there? We need a number to track your impact.'),
        t('planWaste.missingAmount', 'Missing Amount')
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const data: WasteEntryFormData = {
        itemName: itemName.trim(),
        amount: parseFloat(amount),
        unit,
        reason,
        estimatedValue: parseFloat(estimatedValue) || 0,
        notes: notes.trim() || undefined,
      };
      await logWaste(data);

      setItemName('');
      setAmount('');
      setUnit('piece');
      setReason('expired');
      setEstimatedValue('');
      setNotes('');
      setShowAddModal(false);
    } catch {
      showErrorToast(
        t('planWaste.logErrBody', "We couldn't log that waste. Let's try once more."),
        t('planWaste.logErrTitle', 'Log Problem')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWaste = (entryId: string) => {
    Alert.alert(
      t('planWaste.deleteTitle', 'Delete Log?'),
      t('planWaste.deleteBody', 'Are you sure you want to remove this waste entry from your log?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { text: t('planWaste.delete', 'Delete'), style: 'destructive', onPress: () => deleteWaste(entryId) },
      ]
    );
  };

  const proTag = <Tag tone="k" label={t('planWaste.pro', 'Pro')} />;
  const title = t('planWaste.title', 'Waste Tracking');

  // Pro gate
  if (!canTrack) {
    return (
      <Screen bare>
        <TopBar variant="compact" title={title} onBack={() => router.back()} right={proTag} />
        <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 32, gap: 16 }}>
          <View className="items-center justify-center bg-surface-2" style={{ width: 80, height: 80, borderRadius: 40 }}>
            <Icon name="leaf" size="lg" />
          </View>
          <H2 center>{title}</H2>
          <Muted center>
            {t(
              'planWaste.gateBody',
              "Track food waste, see trends, and learn how much you're saving with meal planning."
            )}
          </Muted>
          <View style={{ alignSelf: 'stretch' }}>
            <UButton
              variant="accent"
              icon="star"
              label={t('plan.upgrade', 'Upgrade to Premium')}
              onPress={() => setShowPaywall(true)}
            />
          </View>
        </View>
        <Paywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          feature="Waste Tracking"
          requiredTier="premium"
        />
      </Screen>
    );
  }

  if (isLoading) {
    return <Loading fullScreen message={t('planWaste.loading', 'Loading waste data...')} />;
  }

  return (
    <Screen
      bare
      footer={
        <CtaBar fade>
          <UButton icon="plus" label={t('planWaste.log', 'Log Waste')} onPress={() => setShowAddModal(true)} />
        </CtaBar>
      }
    >
      <TopBar variant="compact" title={title} onBack={() => router.back()} right={proTag} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
      >
        <WasteStatsCard stats={wasteStats} />

        <View className="flex-row items-center justify-between">
          <H2>{t('planWaste.recent', 'Recent')}</H2>
          <Muted small>{t('planWaste.thisWeek', 'This week')}</Muted>
        </View>

        {wasteLog.length === 0 ? (
          <UCard>
            <View className="items-center" style={{ paddingVertical: 12, gap: 8 }}>
              <Icon name="check" size="lg" color="muted" />
              <Title>{t('planWaste.none', 'No waste logged yet')}</Title>
              <Muted small center>
                {t('planWaste.noneHint', 'Keep up the great work')}
              </Muted>
            </View>
          </UCard>
        ) : (
          <Rows>
            {wasteLog.slice(0, 10).map((entry) => (
              <WasteEntryRow key={entry.id} entry={entry} onDelete={() => handleDeleteWaste(entry.id)} />
            ))}
          </Rows>
        )}

        {wasteStats ? (
          <View style={{ paddingTop: 72 }}>
            <UCard>
              <WasteBreakdown wasteByReason={wasteStats.wasteByReason} />
            </UCard>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowAddModal(false)}
      >
        <Screen
          bare
          footer={
            <CtaBar fade>
              <UButton
                icon="plus"
                label={t('planWaste.log', 'Log Waste')}
                loading={isSubmitting}
                onPress={handleLogWaste}
              />
            </CtaBar>
          }
        >
          <TopBar
            variant="compact"
            title={t('planWaste.log', 'Log Waste')}
            left={<UIconButton icon="close" label={t('planGen.cancel', 'Cancel')} onPress={() => setShowAddModal(false)} />}
          />
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 150 }}
            >
              <Field
                label={t('planWaste.itemName', 'Item name')}
                value={itemName}
                onChangeText={setItemName}
                placeholder={t('planWaste.itemPh', 'e.g., Spinach, Chicken, Milk')}
              />
              <View className="flex-row" style={{ gap: 12 }}>
                <View className="flex-1">
                  <Field
                    label={t('planWaste.amount', 'Amount')}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="2"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View className="flex-1">
                  <Field
                    label={t('planWaste.unit', 'Unit')}
                    value={unit}
                    onChangeText={setUnit}
                    placeholder={t('planWaste.unitPh', 'cups, oz')}
                  />
                </View>
              </View>

              <View style={{ gap: 10 }}>
                <Title>{t('planWaste.reason', 'Reason')}</Title>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {(Object.keys(WASTE_REASON_LABELS) as WasteReason[]).map((key) => (
                    <Chip
                      key={key}
                      label={WASTE_REASON_LABELS[key]}
                      on={reason === key}
                      onPress={() => setReason(key)}
                    />
                  ))}
                </View>
              </View>

              <Field
                label={t('planWaste.value', 'Estimated value ($)')}
                value={estimatedValue}
                onChangeText={setEstimatedValue}
                placeholder="5.00"
                keyboardType="decimal-pad"
              />
              <Field
                label={t('planWaste.notes', 'Notes (optional)')}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('planWaste.notesPh', 'Any additional details...')}
                multiline
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </Screen>
      </Modal>
    </Screen>
  );
}
