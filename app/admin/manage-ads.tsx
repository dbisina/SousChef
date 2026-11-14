import React, { useState, useEffect, useCallback } from 'react';
import { Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Timestamp } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { useThemeColors, FIXED } from '@/stores/themeStore';
import { useAdStore } from '@/stores/adStore';
import {
  Chip,
  CtaBar,
  Display,
  Field,
  FONT,
  H2,
  ListRow,
  Muted,
  PhotoCard,
  Rows,
  Screen,
  Sheet,
  Tag,
  Thumb,
  Tile,
  Title,
  TopBar,
  UButton,
  UIconButton,
} from '@/components/ui';
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

const DEFAULT_ACCENT: string = FIXED.accent;
type TagTone = NonNullable<React.ComponentProps<typeof Tag>['tone']>;

/** 12100 -> 12.1k */
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/.0$/, '')}k` : `${n}`);

export default function ManageAdsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { clearAds } = useAdStore();

  const [mode, setMode] = useState<ScreenMode>('list');
  const [ads, setAds] = useState<SponsoredAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAd, setSelectedAd] = useState<SponsoredAd | null>(null);

  // ── Create form state ──
  const [advertiserName, setAdvertiserName] = useState('');
  const [advertiserLogo, setAdvertiserLogo] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [imageURL, setImageURL] = useState('');
  const [ctaText, setCtaText] = useState('Shop Now');
  const [ctaURL, setCtaURL] = useState('');
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
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
  }, [fetchAds]);

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
    setAccentColor(DEFAULT_ACCENT);
    setBudgetDollars('');
    setCpmDollars('5');
    setDurationDays('30');
    setSelectedPlacements(new Set(['welcome_modal', 'home_feed']));
  };

  const missing = (body: string) => Alert.alert(t('account.ads.missing', 'Missing'), body);

  const handleCreate = async () => {
    if (!advertiserName.trim()) return missing(t('account.ads.needAdvertiser', 'Advertiser name is required.'));
    if (!title.trim()) return missing(t('account.ads.needTitle', 'Ad title is required.'));
    if (!subtitle.trim()) return missing(t('account.ads.needSubtitle', 'Ad subtitle is required.'));
    if (!imageURL.trim()) return missing(t('account.ads.needImage', 'Image URL is required.'));
    if (!ctaURL.trim()) return missing(t('account.ads.needCta', 'CTA URL is required.'));
    if (selectedPlacements.size === 0) return missing(t('account.ads.needPlacement', 'Select at least one placement.'));

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
        accentColor: accentColor.trim() || DEFAULT_ACCENT,
      });

      clearAds(); // Clear cached ads so fresh ones load
      Alert.alert(t('account.ads.success', 'Success'), t('account.ads.created', 'Sponsored ad created and is now live!'));
      resetForm();
      setMode('list');
      fetchAds();
    } catch (error: unknown) {
      Alert.alert(
        t('account.error', 'Error'),
        error instanceof Error && error.message ? error.message : t('account.ads.createFailed', 'Failed to create ad.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (ad: SponsoredAd) => {
    setSelectedAd(null);
    try {
      await toggleAdStatus(ad.id, ad.status);
      clearAds();
      fetchAds();
    } catch {
      Alert.alert(t('account.error', 'Error'), t('account.ads.statusFailed', 'Failed to update ad status.'));
    }
  };

  const handleDelete = (ad: SponsoredAd) => {
    setSelectedAd(null);
    Alert.alert(
      t('account.ads.deleteTitle', 'Delete Ad'),
      t('account.ads.deleteBody', 'Delete "{{title}}" by {{advertiser}}?', { title: ad.title, advertiser: ad.advertiserName }),
      [
        { text: t('account.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('account.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSponsoredAd(ad.id);
              clearAds();
              fetchAds();
            } catch {
              Alert.alert(t('account.error', 'Error'), t('account.ads.deleteFailed', 'Failed to delete ad.'));
            }
          },
        },
      ]
    );
  };

  const statusTag = (status: AdStatus) => {
    const config: Record<AdStatus, { tone: TagTone; label: string }> = {
      active: { tone: 'g', label: t('account.ads.statusActive', 'Active') },
      paused: { tone: 'o', label: t('account.ads.statusPaused', 'Paused') },
      expired: { tone: 'default', label: t('account.ads.statusExpired', 'Expired') },
      pending_review: { tone: 'default', label: t('account.ads.statusPending', 'Pending') },
    };
    const c = config[status] || config.expired;
    return <Tag tone={c.tone} label={c.label} />;
  };

  // ── LIST MODE ──
  if (mode === 'list') {
    const featured = ads[0];
    const rest = ads.slice(1);
    return (
      <Screen bare>
        <Stack.Screen options={{ headerShown: false }} />
        <TopBar
          variant="compact"
          title={t('account.ads.title', 'Sponsored Ads')}
          onBack={() => router.back()}
          right={<UIconButton icon="plus" tone="black" label={t('account.ads.create', 'Create ad')} onPress={() => setMode('create')} />}
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 14 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          <View className="flex-row" style={{ gap: 10 }}>
            <View className="flex-1">
              <Tile labelFirst value={ads.filter((a) => a.status === 'active').length} label={t('account.ads.active', 'Active')} />
            </View>
            <View className="flex-1">
              <Tile labelFirst value={compact(ads.reduce((sum, a) => sum + a.impressions, 0))} label={t('account.ads.views', 'Views')} />
            </View>
            <View className="flex-1">
              <Tile labelFirst value={compact(ads.reduce((sum, a) => sum + a.clicks, 0))} label={t('account.ads.clicks', 'Clicks')} />
            </View>
          </View>

          {loading ? (
            <Muted center>{t('account.ads.loading', 'Loading ads...')}</Muted>
          ) : ads.length === 0 ? (
            <View className="items-center" style={{ paddingVertical: 40, gap: 10 }}>
              <Display size={22} center>
                {t('account.ads.none', 'No Sponsored Ads')}
              </Display>
              <Muted center>
                {t('account.ads.noneBody', 'Create your first ad to start monetizing free-tier users.')}
              </Muted>
              <UButton size="sm" label={t('account.ads.createFirst', 'Create First Ad')} onPress={() => setMode('create')} />
            </View>
          ) : (
            <>
              {featured ? (
                <PhotoCard
                  source={{ uri: featured.imageURL }}
                  height={210}
                  topLeft={statusTag(featured.status)}
                  topRight={<Tag tone="glassDark" label={t('account.ads.sponsored', 'Sponsored')} />}
                  title={featured.title}
                  subtitle={t('account.ads.featuredMeta', '{{advertiser}} · {{views}} views · {{ctr}}% CTR', {
                    advertiser: featured.advertiserName,
                    views: compact(getAdMetrics(featured).impressions),
                    ctr: getAdMetrics(featured).ctr,
                  })}
                  onPress={() => setSelectedAd(featured)}
                  accessibilityLabel={featured.title}
                />
              ) : null}
              {rest.length > 0 ? (
                <Rows>
                  {rest.map((ad) => {
                    const m = getAdMetrics(ad);
                    return (
                      <ListRow
                        key={ad.id}
                        leading={<Thumb source={{ uri: ad.imageURL }} name={ad.title} size={52} />}
                        title={ad.title}
                        subtitle={t('account.ads.rowMeta', '{{views}} views · {{ctr}}% CTR', {
                          views: compact(m.impressions),
                          ctr: m.ctr,
                        })}
                        right={statusTag(ad.status)}
                        onPress={() => setSelectedAd(ad)}
                      />
                    );
                  })}
                </Rows>
              ) : null}
            </>
          )}
        </ScrollView>

        <Sheet visible={!!selectedAd} onClose={() => setSelectedAd(null)} title={selectedAd?.title ?? t('account.ads.title', 'Sponsored Ads')}>
          {selectedAd ? (
            <>
              <View style={{ gap: 4 }}>
                <Title>{selectedAd.title}</Title>
                <Muted small>
                  {selectedAd.advertiserName} · {selectedAd.subtitle}
                </Muted>
              </View>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {selectedAd.placements.map((p) => (
                  <Tag key={p} label={AD_PLACEMENT_LABELS[p]} />
                ))}
              </View>
              <UButton
                variant="primary"
                label={selectedAd.status === 'active' ? t('account.ads.pause', 'Pause') : t('account.ads.activate', 'Activate')}
                onPress={() => handleToggleStatus(selectedAd)}
              />
              <UButton variant="ghost" icon="trash" label={t('account.delete', 'Delete')} onPress={() => handleDelete(selectedAd)} />
            </>
          ) : null}
        </Sheet>
      </Screen>
    );
  }

  // ── CREATE MODE ──
  return (
    <Screen
      bare
      footer={
        <CtaBar fade vertical>
          <UButton
            variant="accent"
            label={submitting ? t('account.ads.creating', 'Creating...') : t('account.ads.publish', 'Publish Ad')}
            loading={submitting}
            onPress={handleCreate}
          />
        </CtaBar>
      }
    >
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar
        variant="compact"
        title={t('account.ads.createTitle', 'Create Sponsored Ad')}
        onBack={() => {
          resetForm();
          setMode('list');
        }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150, gap: 14 }}
        >
          <Muted>{t('account.ads.createIntro', 'Fill in the creative details below. The ad goes live immediately once created.')}</Muted>

          <H2>{t('account.ads.advertiser', 'Advertiser')}</H2>
          <Field label={t('account.ads.brand', 'Brand / Advertiser Name *')} value={advertiserName} onChangeText={setAdvertiserName} placeholder="FreshCart" />
          <Field label={t('account.ads.logo', 'Logo URL (optional)')} value={advertiserLogo} onChangeText={setAdvertiserLogo} placeholder="https://..." keyboardType="url" autoCapitalize="none" />

          <H2>{t('account.ads.creative', 'Creative')}</H2>
          <Field label={t('account.ads.headline', 'Headline *')} value={title} onChangeText={setTitle} placeholder="Farm Fresh to Your Door" />
          <Field label={t('account.ads.subtitle', 'Subtitle *')} value={subtitle} onChangeText={setSubtitle} placeholder="Organic ingredients, 20% off first order" />
          <Field label={t('account.ads.imageUrl', 'Image URL *')} value={imageURL} onChangeText={setImageURL} placeholder="https://images.unsplash.com/..." keyboardType="url" autoCapitalize="none" />
          {imageURL.trim().length > 10 ? (
            <View style={{ borderRadius: 24, overflow: 'hidden' }}>
              <Image source={{ uri: imageURL.trim() }} style={{ width: '100%', height: 160 }} contentFit="cover" accessible={false} />
            </View>
          ) : null}
          <Field label={t('account.ads.ctaText', 'CTA Button Text')} value={ctaText} onChangeText={setCtaText} placeholder="Shop Now" />
          <Field label={t('account.ads.ctaUrl', 'CTA Link URL *')} value={ctaURL} onChangeText={setCtaURL} placeholder="https://freshcart.com/?ref=souschef" keyboardType="url" autoCapitalize="none" />

          <H2>{t('account.ads.styling', 'Styling')}</H2>
          <Field label={t('account.ads.accent', 'Accent Color (hex)')} value={accentColor} onChangeText={setAccentColor} placeholder={DEFAULT_ACCENT} autoCapitalize="none" />
          {accentColor ? (
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: accentColor }} />
              <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
                {t('account.ads.accentPreview', 'CTA button color preview')}
              </Text>
            </View>
          ) : null}

          <H2>{t('account.ads.budgetDuration', 'Budget & Duration')}</H2>
          <View className="flex-row" style={{ gap: 12 }}>
            <View className="flex-1">
              <Field label={t('account.ads.budget', 'Total Budget ($)')} value={budgetDollars} onChangeText={setBudgetDollars} placeholder="5000" keyboardType="numeric" />
            </View>
            <View className="flex-1">
              <Field label={t('account.ads.cpm', 'CPM ($)')} value={cpmDollars} onChangeText={setCpmDollars} placeholder="5" keyboardType="numeric" />
            </View>
          </View>
          <Field label={t('account.ads.duration', 'Duration (days)')} value={durationDays} onChangeText={setDurationDays} placeholder="30" keyboardType="numeric" />

          <H2>{t('account.ads.placements', 'Placements *')}</H2>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {(Object.entries(AD_PLACEMENT_LABELS) as [AdPlacement, string][]).map(([key, label]) => (
              <Chip key={key} label={label} on={selectedPlacements.has(key)} onPress={() => togglePlacement(key)} />
            ))}
          </View>

          <Muted small center>
            {t('account.ads.goLive', 'Ad will go live immediately in selected placements.')}
          </Muted>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
