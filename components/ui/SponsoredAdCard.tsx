import React, { useEffect, useCallback } from 'react';
import { Pressable, Text, View, Linking, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useAdStore } from '@/stores/adStore';
import { FIXED } from '@/stores/themeStore';
import { AdPlacement, SponsoredAd } from '@/types/ads';
import { FONT } from './fonts';
import { PhotoCard } from './PhotoCard';
import { Tag } from './Chips';
import { useColor } from './tone';
import { cleanCopy } from '@/lib/text';

interface SponsoredAdCardProps {
  placement: AdPlacement;
  /** If true, show a compact banner style instead of a full card */
  compact?: boolean;
  /** Override: pass an ad directly instead of fetching */
  ad?: SponsoredAd;
  /** Additional className for the wrapper */
  className?: string;
}

export const SponsoredAdCard: React.FC<SponsoredAdCardProps> = ({
  placement,
  compact = false,
  ad: adOverride,
  className = '',
}) => {
  const { t } = useTranslation();
  const { ads, loading, fetchAdForPlacement, trackImpression, trackClick } = useAdStore();
  const spinner = useColor('subtle');

  const ad = adOverride || ads[placement];
  const isLoading = loading[placement];

  // Fetch ad on mount if not provided
  useEffect(() => {
    if (!adOverride) {
      fetchAdForPlacement(placement);
    }
  }, [placement, adOverride]);

  // Track impression when ad becomes visible
  useEffect(() => {
    if (ad?.id) {
      trackImpression(ad.id);
    }
  }, [ad?.id]);

  const handlePress = useCallback(async () => {
    if (!ad) return;

    trackClick(ad.id);

    try {
      const supported = await Linking.canOpenURL(ad.ctaURL);
      if (supported) {
        await Linking.openURL(ad.ctaURL);
      }
    } catch (error) {
      console.warn('Failed to open ad URL:', error);
    }
  }, [ad]);

  if (isLoading && !ad) {
    return (
      <View className={`mx-6 mt-4 items-center justify-center py-8 ${className}`}>
        <ActivityIndicator size="small" color={spinner} />
      </View>
    );
  }

  if (!ad) return null;

  const cta = cleanCopy(ad.ctaText);
  const title = cleanCopy(ad.title);
  const subtitle = cleanCopy(ad.subtitle);
  const advertiser = cleanCopy(ad.advertiserName);
  const sponsored = t('account.ads.sponsored', 'Sponsored');

  // ── Compact Banner Format ──
  if (compact) {
    return (
      <Animated.View entering={FadeIn.duration(400)} className={`mx-4 mt-3 ${className}`}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${sponsored}: ${title}`}
          onPress={handlePress}
          className="flex-row items-center bg-surface"
          style={{ borderRadius: 24, padding: 12, gap: 12 }}
        >
          <Image
            source={{ uri: ad.imageURL }}
            style={{ width: 56, height: 56, borderRadius: 17 }}
            contentFit="cover"
            accessible={false}
          />
          <View className="flex-1" style={{ minWidth: 0, gap: 2 }}>
            <Tag label={sponsored} />
            <Text className="text-ink" numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: 15 }}>
              {title}
            </Text>
            <Text className="text-muted" numberOfLines={1} style={{ fontFamily: FONT.sans, fontSize: 12 }}>
              {subtitle}
            </Text>
          </View>
          <View
            className="items-center justify-center"
            style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: ad.accentColor || FIXED.accent }}
          >
            <Text style={{ fontFamily: FONT.sansMedium, fontSize: 12, color: FIXED.night }}>{cta}</Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  // ── Full Card Format (used in WelcomeModal, Home Feed) ──
  return (
    <Animated.View entering={FadeIn.duration(400)} className={`mx-6 mt-4 ${className}`}>
      <PhotoCard
        source={{ uri: ad.imageURL }}
        height={320}
        topLeft={<Tag tone="glassDark" label={sponsored} />}
        onPress={handlePress}
        accessibilityLabel={`${sponsored}: ${title}`}
        glassBar={
          <>
            <View className="flex-1" style={{ minWidth: 0, gap: 2 }}>
              {ad.advertiserLogo ? (
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <Image source={{ uri: ad.advertiserLogo }} style={{ width: 18, height: 18, borderRadius: 9 }} accessible={false} />
                  <Text className="text-muted" numberOfLines={1} style={{ fontFamily: FONT.sans, fontSize: 12 }}>
                    {advertiser}
                  </Text>
                </View>
              ) : null}
              <Text className="text-ink" numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: 16 }}>
                {title}
              </Text>
              <Text className="text-muted" numberOfLines={1} style={{ fontFamily: FONT.sans, fontSize: 12 }}>
                {subtitle}
              </Text>
            </View>
            <View
              className="items-center justify-center"
              style={{ height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: ad.accentColor || FIXED.accent }}
            >
              <Text style={{ fontFamily: FONT.display, fontSize: 14, color: FIXED.night }}>{cta}</Text>
            </View>
          </>
        }
      />
    </Animated.View>
  );
};
