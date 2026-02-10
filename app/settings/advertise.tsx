import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '@/stores/themeStore';
import { Button } from '@/components/ui';
import { submitAdInquiry } from '@/services/adService';
import {
  AdPlacement,
  AdBudgetRange,
  AD_BUDGET_LABELS,
  AD_PLACEMENT_LABELS,
} from '@/types/ads';

export default function AdvertiseScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [website, setWebsite] = useState('');
  const [message, setMessage] = useState('');
  const [budget, setBudget] = useState<AdBudgetRange | null>(null);
  const [placements, setPlacements] = useState<Set<AdPlacement>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const togglePlacement = (p: AdPlacement) => {
    const newSet = new Set(placements);
    if (newSet.has(p)) {
      newSet.delete(p);
    } else {
      newSet.add(p);
    }
    setPlacements(newSet);
  };

  const validate = (): boolean => {
    if (!name.trim()) { Alert.alert('Missing Info', 'Please enter your name.'); return false; }
    if (!email.trim() || !email.includes('@')) { Alert.alert('Missing Info', 'Please enter a valid email.'); return false; }
    if (!company.trim()) { Alert.alert('Missing Info', 'Please enter your company name.'); return false; }
    if (!budget) { Alert.alert('Missing Info', 'Please select a budget range.'); return false; }
    if (placements.size === 0) { Alert.alert('Missing Info', 'Please select at least one ad placement.'); return false; }
    return true;
  };

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await submitAdInquiry({
        name: name.trim(),
        email: email.trim(),
        company: company.trim(),
        website: website.trim() || undefined,
        budget: budget!,
        placements: Array.from(placements),
        message: message.trim(),
      });
      setSubmitted(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [name, email, company, website, budget, placements, message]);

  // ── Success State ──
  if (submitted) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900" edges={['top']}>
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-green-100 items-center justify-center mb-6">
            <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
          </View>
          <Text className="text-2xl font-bold text-neutral-800 dark:text-white text-center mb-3">
            Inquiry Sent!
          </Text>
          <Text className="text-base text-neutral-500 dark:text-neutral-400 text-center mb-8 leading-6">
            Thanks for your interest in advertising on SousChef. We'll review
            your inquiry and get back to you within 48 hours.
          </Text>
          <Button
            title="Back to Settings"
            onPress={() => router.back()}
            variant="primary"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-neutral-800 dark:text-white ml-2">
          Advertise on SousChef
        </Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-10 pt-4"
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <LinearGradient
            colors={['#F0FDF4', '#DCFCE7']}
            className="rounded-2xl p-5 mb-6"
          >
            <View className="flex-row items-center mb-2">
              <Ionicons name="megaphone" size={22} color="#16A34A" />
              <Text className="text-lg font-bold text-green-800 ml-2">
                Reach Passionate Home Cooks
              </Text>
            </View>
            <Text className="text-sm text-green-700 leading-5">
              SousChef users actively cook 3-5 times per week. Place your brand
              in front of an engaged audience at the moment they're making
              purchasing decisions about ingredients and kitchen tools.
            </Text>
          </LinearGradient>

          {/* Stats Row */}
          <View className="flex-row mb-6 gap-3">
            {[
              { label: 'Active Cooks', value: '10K+', icon: 'people' as const },
              { label: 'Recipes/Week', value: '50K+', icon: 'restaurant' as const },
              { label: 'Avg. Session', value: '8 min', icon: 'time' as const },
            ].map((stat) => (
              <View
                key={stat.label}
                className="flex-1 bg-neutral-50 dark:bg-neutral-800 rounded-xl p-3 items-center"
              >
                <Ionicons name={stat.icon} size={20} color="#9CA3AF" />
                <Text className="text-lg font-bold text-neutral-800 dark:text-white mt-1">
                  {stat.value}
                </Text>
                <Text className="text-[10px] text-neutral-500 mt-0.5">{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Form */}
          <Text className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 mb-3 tracking-wide uppercase">
            Contact Info
          </Text>

          <InputField label="Your Name *" value={name} onChangeText={setName} placeholder="Jane Smith" colors={colors} />
          <InputField label="Email *" value={email} onChangeText={setEmail} placeholder="jane@brand.com" keyboardType="email-address" colors={colors} />
          <InputField label="Company *" value={company} onChangeText={setCompany} placeholder="FreshCart Inc." colors={colors} />
          <InputField label="Website" value={website} onChangeText={setWebsite} placeholder="https://freshcart.com" keyboardType="url" colors={colors} />

          {/* Budget */}
          <Text className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 mb-3 mt-4 tracking-wide uppercase">
            Monthly Budget *
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-5">
            {(Object.entries(AD_BUDGET_LABELS) as [AdBudgetRange, string][]).map(
              ([key, label]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setBudget(key)}
                  className={`px-4 py-2.5 rounded-full border ${
                    budget === key
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      budget === key ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>

          {/* Placements */}
          <Text className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 mb-3 tracking-wide uppercase">
            Preferred Placements *
          </Text>
          <View className="gap-2 mb-5">
            {(Object.entries(AD_PLACEMENT_LABELS) as [AdPlacement, string][]).map(
              ([key, label]) => {
                const selected = placements.has(key);
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => togglePlacement(key)}
                    className={`flex-row items-center px-4 py-3 rounded-xl border ${
                      selected
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-400'
                        : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={selected ? '#22C55E' : '#9CA3AF'}
                    />
                    <Text
                      className={`ml-3 text-sm font-medium ${
                        selected ? 'text-green-700 dark:text-green-400' : 'text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}
          </View>

          {/* Message */}
          <Text className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 mb-3 tracking-wide uppercase">
            Tell Us About Your Campaign
          </Text>
          <TextInput
            className="bg-neutral-50 dark:bg-neutral-800 rounded-xl px-4 py-3 text-base text-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700 mb-6"
            placeholder="What product or message do you want to promote?"
            placeholderTextColor="#9CA3AF"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={{ minHeight: 100 }}
          />

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#22C55E', '#16A34A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="rounded-xl py-4 items-center"
            >
              <Text className="text-white font-bold text-base">
                {submitting ? 'Submitting...' : 'Submit Inquiry'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text className="text-xs text-neutral-400 text-center mt-3 mb-6">
            We'll get back to you within 48 hours.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Reusable Input Field ──
function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'url';
  colors: any;
}) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
        {label}
      </Text>
      <TextInput
        className="bg-neutral-50 dark:bg-neutral-800 rounded-xl px-4 py-3 text-base text-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700"
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || 'default'}
        autoCapitalize={keyboardType === 'email-address' || keyboardType === 'url' ? 'none' : 'words'}
      />
    </View>
  );
}
