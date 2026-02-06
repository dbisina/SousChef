import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWasteTracking, useMealPlanAccess } from '@/hooks/useMealPlan';
import {
  WasteStatsCard,
  WasteEntryRow,
  WasteBreakdown,
} from '@/components/mealplan';
import { Card, Button, Loading, Empty } from '@/components/ui';
import { Paywall } from '@/components/subscription';
import {
  WasteReason,
  WasteEntryFormData,
  WASTE_REASON_LABELS,
} from '@/types/mealplan';

export default function WasteTrackingScreen() {
  const router = useRouter();
  const {
    wasteLog,
    wasteStats,
    isLoading,
    canTrack,
    weeklyWaste,
    monthlyWaste,
    savedByPlanning,
    logWaste,
    deleteWaste,
  } = useWasteTracking();

  const { isPremium, isPro } = useMealPlanAccess();

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

  // Handle log waste
  const handleLogWaste = async () => {
    if (!itemName.trim()) {
      Alert.alert('Missing Information', 'Please enter an item name.');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Missing Information', 'Please enter a valid amount.');
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

      // Reset form
      setItemName('');
      setAmount('');
      setUnit('piece');
      setReason('expired');
      setEstimatedValue('');
      setNotes('');
      setShowAddModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to log waste. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete waste
  const handleDeleteWaste = (entryId: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this waste entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteWaste(entryId),
        },
      ]
    );
  };

  // Show paywall for users without access
  if (!canTrack) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50">
        <View className="flex-row items-center px-4 py-3 bg-white border-b border-neutral-100">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#404040" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-neutral-900 ml-4">
            Waste Tracking
          </Text>
        </View>

        <View className="flex-1 items-center justify-center p-8">
          <View className="w-20 h-20 rounded-full bg-green-100 items-center justify-center mb-6">
            <Ionicons name="leaf-outline" size={40} color="#22C55E" />
          </View>
          <Text className="text-2xl font-bold text-neutral-900 text-center mb-2">
            Waste Tracking
          </Text>
          <Text className="text-neutral-500 text-center mb-6">
            Track food waste, see trends, and learn how much you're saving
            with meal planning.
          </Text>
          <Button
            title="Upgrade to Premium"
            onPress={() => setShowPaywall(true)}
            leftIcon={<Ionicons name="star" size={20} color="white" />}
          />
        </View>

        <Paywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          feature="Waste Tracking"
          requiredTier="premium"
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return <Loading fullScreen message="Loading waste data..." />;
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-neutral-100">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#404040" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-neutral-900">Waste Tracking</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)}>
          <Ionicons name="add-circle-outline" size={28} color="#FF6B35" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Stats card */}
          <WasteStatsCard stats={wasteStats} />

          {/* Waste breakdown */}
          {wasteStats && (
            <Card className="mt-4">
              <WasteBreakdown wasteByReason={wasteStats.wasteByReason} />
            </Card>
          )}

          {/* Recent waste log */}
          <View className="mt-6">
            <Text className="text-lg font-bold text-neutral-900 mb-3">
              Recent Waste Log
            </Text>

            {wasteLog.length === 0 ? (
              <Card className="bg-neutral-50">
                <View className="items-center py-6">
                  <Ionicons name="checkmark-circle-outline" size={48} color="#22C55E" />
                  <Text className="text-neutral-600 mt-2 text-center">
                    No waste logged yet!
                  </Text>
                  <Text className="text-neutral-400 text-sm text-center mt-1">
                    Keep up the great work
                  </Text>
                </View>
              </Card>
            ) : (
              <Card variant="outlined" className="p-0 overflow-hidden">
                {wasteLog.slice(0, 10).map((entry) => (
                  <WasteEntryRow
                    key={entry.id}
                    entry={entry}
                    onDelete={() => handleDeleteWaste(entry.id)}
                  />
                ))}
                {wasteLog.length > 10 && (
                  <TouchableOpacity className="p-4 items-center">
                    <Text className="text-primary-500 font-medium">
                      View all {wasteLog.length} entries
                    </Text>
                  </TouchableOpacity>
                )}
              </Card>
            )}
          </View>

          {/* Tips */}
          <Card className="mt-6 bg-green-50 border border-green-200">
            <View className="flex-row items-start">
              <Ionicons name="bulb" size={20} color="#22C55E" />
              <View className="flex-1 ml-3">
                <Text className="text-green-800 font-semibold">
                  Tips to Reduce Waste
                </Text>
                <Text className="text-green-600 text-sm mt-1">
                  • Plan meals around expiring ingredients{'\n'}
                  • Use the "first in, first out" method{'\n'}
                  • Freeze items before they spoil{'\n'}
                  • Store produce properly
                </Text>
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* Add waste modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          {/* Modal header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-neutral-100">
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Text className="text-neutral-500">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-lg font-bold text-neutral-900">Log Waste</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView className="flex-1 p-4">
            {/* Item name */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-neutral-700 mb-2">
                Item Name *
              </Text>
              <TextInput
                value={itemName}
                onChangeText={setItemName}
                placeholder="e.g., Spinach, Chicken, Milk"
                className="border border-neutral-300 rounded-xl px-4 py-3 text-base"
              />
            </View>

            {/* Amount and unit */}
            <View className="flex-row mb-4">
              <View className="flex-1 mr-2">
                <Text className="text-sm font-medium text-neutral-700 mb-2">
                  Amount *
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="e.g., 2"
                  keyboardType="decimal-pad"
                  className="border border-neutral-300 rounded-xl px-4 py-3 text-base"
                />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-sm font-medium text-neutral-700 mb-2">
                  Unit
                </Text>
                <TextInput
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="e.g., cups, oz"
                  className="border border-neutral-300 rounded-xl px-4 py-3 text-base"
                />
              </View>
            </View>

            {/* Reason */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-neutral-700 mb-2">
                Reason
              </Text>
              <View className="flex-row flex-wrap">
                {(Object.keys(WASTE_REASON_LABELS) as WasteReason[]).map(
                  (reasonKey) => (
                    <TouchableOpacity
                      key={reasonKey}
                      onPress={() => setReason(reasonKey)}
                      className={`mr-2 mb-2 px-4 py-2 rounded-full border ${
                        reason === reasonKey
                          ? 'bg-red-500 border-red-500'
                          : 'bg-white border-neutral-300'
                      }`}
                    >
                      <Text
                        className={
                          reason === reasonKey
                            ? 'text-white font-medium'
                            : 'text-neutral-600'
                        }
                      >
                        {WASTE_REASON_LABELS[reasonKey]}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>

            {/* Estimated value */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-neutral-700 mb-2">
                Estimated Value ($)
              </Text>
              <TextInput
                value={estimatedValue}
                onChangeText={setEstimatedValue}
                placeholder="e.g., 5.00"
                keyboardType="decimal-pad"
                className="border border-neutral-300 rounded-xl px-4 py-3 text-base"
              />
            </View>

            {/* Notes */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-neutral-700 mb-2">
                Notes (optional)
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Any additional details..."
                multiline
                numberOfLines={3}
                className="border border-neutral-300 rounded-xl px-4 py-3 text-base"
                style={{ textAlignVertical: 'top', minHeight: 80 }}
              />
            </View>
          </ScrollView>

          {/* Submit button */}
          <View className="p-4 border-t border-neutral-100">
            <Button
              title={isSubmitting ? 'Logging...' : 'Log Waste'}
              onPress={handleLogWaste}
              isLoading={isSubmitting}
              fullWidth
              leftIcon={
                !isSubmitting && (
                  <Ionicons name="trash-outline" size={20} color="white" />
                )
              }
              variant="danger"
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
