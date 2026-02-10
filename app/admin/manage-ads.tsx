import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Timestamp } from 'firebase/firestore';
import { useThemeColors } from '@/stores/themeStore';
import { useAdStore } from '@/stores/adStore';
import { Button, Card } from '@/components/ui';
import {
  getAllAds,
  createSponsoredAd,
  toggleAdStatus,
  deleteSponsoredAd,
  getAdMetrics,
} from '@/services/adService';
import {
  SponsoredAd,
  AdPlacement,
  AdStatus,
  AD_PLACEMENT_LABELS,
} from '@/types/ads';

type ScreenMode = 'list' | 'create';

export default function ManageAdsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { clearAds } = useAdStore();

  const [mode, setMode] = useState<ScreenMode>('list');
  const [ads, setAds] = useState<SponsoredAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Create form state ──
  const [advertiserName, setAdvertiserName] = useState('');
  const [advertiserLogo, setAdvertiserLogo] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [imageURL, setImageURL] = useState('');
  const [ctaText, setCtaText] = useState('Shop Now');
  const [ctaURL, setCtaURL] = useState('');
  const [accentColor, setAccentColor] = useState('#22C55E');
  const [budgetDollars, setBudgetDollars] = useState('');
  const [cpmDollars, setCpmDollars] = useState('5');
  const [durationDays, setDurationDays] = useState('30');
  const [selectedPlacements, setSelectedPlacements] = useState<Set<AdPlacement>>(
    new Set(['welcome_modal', 'home_feed'])
  );
  const [submitting, setSubmitting] = useState(false);

  const fetchAds = useCallback(async () => {
    const result = await getAllAds();
    setAds(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAds();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAds();
    setRefreshing(false);
  };

  const togglePlacement = (p: AdPlacement) => {
    const newSet = new Set(selectedPlacements);
    if (newSet.has(p)) newSet.delete(p);
    else newSet.add(p);
    setSelectedPlacements(newSet);
  };

  const resetForm = () => {
    setAdvertiserName('');
    setAdvertiserLogo('');
    setTitle('');
    setSubtitle('');
    setImageURL('');
    setCtaText('Shop Now');
    setCtaURL('');
    setAccentColor('#22C55E');
    setBudgetDollars('');
    setCpmDollars('5');
    setDurationDays('30');
    setSelectedPlacements(new Set(['welcome_modal', 'home_feed']));
  };

  const handleCreate = async () => {
    if (!advertiserName.trim()) return Alert.alert('Missing', 'Advertiser name is required.');
    if (!title.trim()) return Alert.alert('Missing', 'Ad title is required.');
    if (!subtitle.trim()) return Alert.alert('Missing', 'Ad subtitle is required.');
    if (!imageURL.trim()) return Alert.alert('Missing', 'Image URL is required.');
    if (!ctaURL.trim()) return Alert.alert('Missing', 'CTA URL is required.');
    if (selectedPlacements.size === 0) return Alert.alert('Missing', 'Select at least one placement.');

    setSubmitting(true);
    try {
      const now = Timestamp.now();
      const days = parseInt(durationDays) || 30;
      const endDate = Timestamp.fromDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000));

      await createSponsoredAd({
        advertiserId: advertiserName.toLowerCase().replace(/\s+/g, '_'),
        advertiserName: advertiserName.trim(),
        advertiserLogo: advertiserLogo.trim() || undefined,
        title: title.trim(),
        subtitle: subtitle.trim(),
        imageURL: imageURL.trim(),
        ctaText: ctaText.trim() || 'Shop Now',
        ctaURL: ctaURL.trim(),
        placements: Array.from(selectedPlacements),
        format: 'card',
        status: 'active',
        startDate: now,
        endDate,
        budgetCents: Math.round((parseFloat(budgetDollars) || 0) * 100),
        cpmCents: Math.round((parseFloat(cpmDollars) || 5) * 100),
        accentColor: accentColor.trim() || '#22C55E',
      });

      clearAds(); // Clear cached ads so fresh ones load
      Alert.alert('Success', 'Sponsored ad created and is now live!');
      resetForm();
      setMode('list');
      fetchAds();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create ad.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (ad: SponsoredAd) => {
    try {
      await toggleAdStatus(ad.id, ad.status);
      clearAds();
      fetchAds();
    } catch {
      Alert.alert('Error', 'Failed to update ad status.');
    }
  };

  const handleDelete = (ad: SponsoredAd) => {
    Alert.alert('Delete Ad', `Delete "${ad.title}" by ${ad.advertiserName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSponsoredAd(ad.id);
            clearAds();
            fetchAds();
          } catch {
            Alert.alert('Error', 'Failed to delete ad.');
          }
        },
      },
    ]);
  };

  // ── LIST MODE ──
  if (mode === 'list') {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900" edges={['bottom']}>
        <Stack.Screen
          options={{
            title: 'Manage Ads',
            headerBackTitle: 'Profile',
            headerRight: () => (
              <TouchableOpacity onPress={() => setMode('create')} className="mr-2">
                <Ionicons name="add-circle" size={28} color={colors.accent} />
              </TouchableOpacity>
            ),
          }}
        />

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-10 pt-4"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          {/* Summary */}
          <View className="flex-row gap-3 mb-6">
            <View className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-xl p-4 items-center">
              <Text className="text-2xl font-bold text-green-700 dark:text-green-400">
                {ads.filter((a) => a.status === 'active').length}
              </Text>
              <Text className="text-xs text-green-600 dark:text-green-500 mt-1">Active</Text>
            </View>
            <View className="flex-1 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 items-center">
              <Text className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {ads.reduce((sum, a) => sum + a.impressions, 0).toLocaleString()}
              </Text>
              <Text className="text-xs text-amber-600 dark:text-amber-500 mt-1">Impressions</Text>
            </View>
            <View className="flex-1 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 items-center">
              <Text className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {ads.reduce((sum, a) => sum + a.clicks, 0).toLocaleString()}
              </Text>
              <Text className="text-xs text-blue-600 dark:text-blue-500 mt-1">Clicks</Text>
            </View>
          </View>

          {/* Ad List */}
          {loading ? (
            <View className="items-center py-12">
              <Text className="text-neutral-400">Loading ads...</Text>
            </View>
          ) : ads.length === 0 ? (
            <View className="items-center py-12">
              <View className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-800 items-center justify-center mb-4">
                <Ionicons name="megaphone-outline" size={40} color="#9CA3AF" />
              </View>
              <Text className="text-lg font-semibold text-neutral-700 dark:text-neutral-300 text-center">
                No Sponsored Ads
              </Text>
              <Text className="text-neutral-500 text-center mt-2 px-8 mb-6">
                Create your first ad to start monetizing free-tier users.
              </Text>
              <Button title="Create First Ad" onPress={() => setMode('create')} />
            </View>
          ) : (
            ads.map((ad) => {
              const metrics = getAdMetrics(ad);
              return (
                <View
                  key={ad.id}
                  className="mb-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700 overflow-hidden"
                >
                  {/* Preview row */}
                  <View className="flex-row p-4">
                    <Image
                      source={{ uri: ad.imageURL }}
                      className="w-16 h-16 rounded-xl"
                      resizeMode="cover"
                    />
                    <View className="flex-1 ml-3">
                      <View className="flex-row items-center">
                        <Text className="text-sm font-bold text-neutral-800 dark:text-white flex-1" numberOfLines={1}>
                          {ad.title}
                        </Text>
                        <StatusBadge status={ad.status} />
                      </View>
                      <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5" numberOfLines={1}>
                        {ad.advertiserName} · {ad.subtitle}
                      </Text>
                      <View className="flex-row mt-2 gap-3">
                        <MiniStat label="Views" value={metrics.impressions.toLocaleString()} />
                        <MiniStat label="Clicks" value={metrics.clicks.toLocaleString()} />
                        <MiniStat label="CTR" value={`${metrics.ctr}%`} />
                      </View>
                    </View>
                  </View>

                  {/* Placements */}
                  <View className="px-4 pb-2">
                    <View className="flex-row flex-wrap gap-1">
                      {ad.placements.map((p) => (
                        <View key={p} className="bg-neutral-200/50 dark:bg-neutral-700 px-2 py-0.5 rounded-md">
                          <Text className="text-[10px] text-neutral-600 dark:text-neutral-400">
                            {AD_PLACEMENT_LABELS[p]}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Actions row */}
                  <View className="flex-row border-t border-neutral-200 dark:border-neutral-600">
                    <TouchableOpacity
                      onPress={() => handleToggleStatus(ad)}
                      className="flex-1 flex-row items-center justify-center py-3"
                    >
                      <Ionicons
                        name={ad.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'}
                        size={18}
                        color={ad.status === 'active' ? '#F59E0B' : '#22C55E'}
                      />
                      <Text
                        className={`ml-1.5 text-sm font-medium ${
                          ad.status === 'active' ? 'text-amber-600' : 'text-green-600'
                        }`}
                      >
                        {ad.status === 'active' ? 'Pause' : 'Activate'}
                      </Text>
                    </TouchableOpacity>
                    <View className="w-px bg-neutral-200 dark:bg-neutral-600" />
                    <TouchableOpacity
                      onPress={() => handleDelete(ad)}
                      className="flex-1 flex-row items-center justify-center py-3"
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      <Text className="ml-1.5 text-sm font-medium text-red-500">Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── CREATE MODE ──
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Create Sponsored Ad',
          headerLeft: () => (
            <TouchableOpacity onPress={() => { resetForm(); setMode('list'); }} className="ml-2">
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-10 pt-4"
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <LinearGradient colors={['#FFF7ED', '#FFEDD5']} className="rounded-2xl p-5 mb-6">
            <View className="flex-row items-center mb-1">
              <Ionicons name="megaphone" size={20} color="#EA580C" />
              <Text className="text-base font-bold text-orange-800 ml-2">New Sponsored Ad</Text>
            </View>
            <Text className="text-sm text-orange-700 leading-5">
              Fill in the creative details below. The ad goes live immediately once created.
            </Text>
          </LinearGradient>

          {/* Advertiser */}
          <SectionHeader title="Advertiser" />
          <FormInput label="Brand / Advertiser Name *" value={advertiserName} onChangeText={setAdvertiserName} placeholder="FreshCart" />
          <FormInput label="Logo URL (optional)" value={advertiserLogo} onChangeText={setAdvertiserLogo} placeholder="https://..." keyboardType="url" />

          {/* Creative */}
          <SectionHeader title="Creative" />
          <FormInput label="Headline *" value={title} onChangeText={setTitle} placeholder="Farm Fresh to Your Door" />
          <FormInput label="Subtitle *" value={subtitle} onChangeText={setSubtitle} placeholder="Organic ingredients — 20% off first order" />
          <FormInput label="Image URL *" value={imageURL} onChangeText={setImageURL} placeholder="https://images.unsplash.com/..." keyboardType="url" />

          {/* Image preview */}
          {imageURL.trim().length > 10 && (
            <View className="mb-4 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700">
              <Image
                source={{ uri: imageURL.trim() }}
                className="w-full h-40"
                resizeMode="cover"
              />
            </View>
          )}

          <FormInput label="CTA Button Text" value={ctaText} onChangeText={setCtaText} placeholder="Shop Now" />
          <FormInput label="CTA Link URL *" value={ctaURL} onChangeText={setCtaURL} placeholder="https://freshcart.com/?ref=souschef" keyboardType="url" />

          {/* Styling */}
          <SectionHeader title="Styling" />
          <FormInput label="Accent Color (hex)" value={accentColor} onChangeText={setAccentColor} placeholder="#22C55E" />
          {accentColor && (
            <View className="flex-row items-center mb-4 gap-3">
              <View className="w-8 h-8 rounded-full border border-neutral-200" style={{ backgroundColor: accentColor }} />
              <Text className="text-xs text-neutral-500">CTA button color preview</Text>
            </View>
          )}

          {/* Budget & Duration */}
          <SectionHeader title="Budget & Duration" />
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <FormInput label="Total Budget ($)" value={budgetDollars} onChangeText={setBudgetDollars} placeholder="5000" keyboardType="numeric" />
            </View>
            <View className="flex-1">
              <FormInput label="CPM ($)" value={cpmDollars} onChangeText={setCpmDollars} placeholder="5" keyboardType="numeric" />
            </View>
          </View>
          <FormInput label="Duration (days)" value={durationDays} onChangeText={setDurationDays} placeholder="30" keyboardType="numeric" />

          {/* Placements */}
          <SectionHeader title="Placements *" />
          <View className="gap-2 mb-6">
            {(Object.entries(AD_PLACEMENT_LABELS) as [AdPlacement, string][]).map(([key, label]) => {
              const selected = selectedPlacements.has(key);
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => togglePlacement(key)}
                  className={`flex-row items-center px-4 py-3 rounded-xl border ${
                    selected
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400'
                      : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  <Ionicons
                    name={selected ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={selected ? '#EA580C' : '#9CA3AF'}
                  />
                  <Text
                    className={`ml-3 text-sm font-medium ${
                      selected ? 'text-orange-700 dark:text-orange-400' : 'text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Submit */}
          <TouchableOpacity onPress={handleCreate} disabled={submitting} activeOpacity={0.85}>
            <LinearGradient
              colors={['#F97316', '#EA580C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="rounded-xl py-4 items-center"
            >
              <Text className="text-white font-bold text-base">
                {submitting ? 'Creating...' : 'Publish Ad'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text className="text-xs text-neutral-400 text-center mt-3 mb-4">
            Ad will go live immediately in selected placements.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Subcomponents ──

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase mb-3 mt-4 tracking-wide">
      {title}
    </Text>
  );
}

function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'url' | 'numeric';
}) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">{label}</Text>
      <TextInput
        className="bg-neutral-50 dark:bg-neutral-800 rounded-xl px-4 py-3 text-base text-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700"
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || 'default'}
        autoCapitalize={keyboardType === 'url' || keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );
}

function StatusBadge({ status }: { status: AdStatus }) {
  const config: Record<AdStatus, { bg: string; text: string; label: string }> = {
    active: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Active' },
    paused: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Paused' },
    expired: { bg: 'bg-neutral-100 dark:bg-neutral-700', text: 'text-neutral-500 dark:text-neutral-400', label: 'Expired' },
    pending_review: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Pending' },
  };
  const c = config[status] || config.expired;
  return (
    <View className={`px-2 py-0.5 rounded-full ${c.bg}`}>
      <Text className={`text-[10px] font-semibold ${c.text}`}>{c.label}</Text>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-xs font-bold text-neutral-700 dark:text-neutral-300">{value}</Text>
      <Text className="text-[10px] text-neutral-400">{label}</Text>
    </View>
  );
}
