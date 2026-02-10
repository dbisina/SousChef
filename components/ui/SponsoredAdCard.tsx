import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAdStore } from '@/stores/adStore';
import { AdPlacement, SponsoredAd } from '@/types/ads';

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
  const { ads, loading, fetchAdForPlacement, trackImpression, trackClick } = useAdStore();

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
        <ActivityIndicator size="small" color="#9CA3AF" />
      </View>
    );
  }

  if (!ad) return null;

  // ── Compact Banner Format ──
  if (compact) {
    return (
      <Animated.View entering={FadeIn.duration(400)} className={`mx-4 mt-3 ${className}`}>
        <Text className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-1 text-center tracking-widest">
          SPONSORED
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handlePress}
          className="flex-row items-center bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-3 border border-neutral-100 dark:border-neutral-700"
        >
          <Image
            source={{ uri: ad.imageURL }}
            className="w-14 h-14 rounded-xl"
            resizeMode="cover"
          />
          <View className="flex-1 ml-3 mr-2">
            <Text className="text-sm font-semibold text-neutral-800 dark:text-white" numberOfLines={1}>
              {ad.title}
            </Text>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5" numberOfLines={1}>
              {ad.subtitle}
            </Text>
          </View>
          <View
            className="px-3.5 py-1.5 rounded-full"
            style={{ backgroundColor: ad.accentColor || '#22C55E' }}
          >
            <Text className="text-white text-xs font-semibold">{ad.ctaText}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // ── Full Card Format (used in WelcomeModal, Home Feed) ──
  return (
    <Animated.View entering={FadeIn.duration(400)} className={`mx-6 mt-4 ${className}`}>
      <Text className="text-xs text-neutral-400 dark:text-neutral-500 text-center mb-2 tracking-widest">
        SPONSORED
      </Text>
      <TouchableOpacity activeOpacity={0.9} onPress={handlePress}>
        <View className="rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800">
          {/* 1:1 Aspect Ratio Image */}
          <Image
            source={{ uri: ad.imageURL }}
            className="w-full aspect-square"
            resizeMode="cover"
          />
          {/* Gradient overlay with advertiser info + CTA */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            className="absolute bottom-0 left-0 right-0 p-6"
          >
            <View className="flex-row items-center justify-between p-[20px]">
              <View className="flex-1 mr-4">
                {ad.advertiserLogo && (
                  <View className="flex-row items-center mb-1.5">
                    <Image
                      source={{ uri: ad.advertiserLogo }}
                      className="w-5 h-5 rounded-full mr-1.5"
                    />
                    <Text className="text-white/60 text-xs">{ad.advertiserName}</Text>
                  </View>
                )}
                <Text className="text-white font-bold text-lg">{ad.title}</Text>
                <Text className="text-white/80 text-sm mt-0.5">{ad.subtitle}</Text>
              </View>
              <View
                className="px-5 py-2.5 rounded-full shadow-sm"
                style={{ backgroundColor: ad.accentColor || '#22C55E' }}
              >
                <Text className="text-white font-semibold">{ad.ctaText}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};
