import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, Linking } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAdStore } from '@/stores/adStore';

/**
 * AdMob-style banner ad component.
 *
 * Currently renders a native sponsored banner powered by the SousChef ad service.
 * When you're ready to integrate real AdMob (requires a custom dev build):
 *   1. `npm install react-native-google-mobile-ads`
 *   2. Add the plugin back to app.json
 *   3. Swap this component for the real BannerAd from the SDK
 *
 * Hidden for subscribers — callers must gate with adFree check.
 */

interface AdMobBannerProps {
  /** Additional wrapper class */
  className?: string;
}

export const AdMobBanner: React.FC<AdMobBannerProps> = ({ className = '' }) => {
  const { ads, fetchAdForPlacement, trackImpression, trackClick } = useAdStore();
  const [loaded, setLoaded] = useState(false);

  const ad = ads['home_feed']; // reuse the home_feed ad slot

  useEffect(() => {
    fetchAdForPlacement('home_feed').then(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (ad?.id) trackImpression(ad.id);
  }, [ad?.id]);

  const handlePress = useCallback(async () => {
    if (!ad) return;
    trackClick(ad.id);
    try {
      const supported = await Linking.canOpenURL(ad.ctaURL);
      if (supported) await Linking.openURL(ad.ctaURL);
    } catch {}
  }, [ad]);

  if (!loaded || !ad) return null;

  return (
    <Animated.View entering={FadeIn.duration(300)} className={`items-center ${className}`}>
      <Text className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-1 tracking-widest text-center">
        ADVERTISEMENT
      </Text>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        className="w-full flex-row items-center bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-3 border border-neutral-100 dark:border-neutral-700"
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
        <View className="flex-row items-center">
          <View
            className="px-3.5 py-1.5 rounded-full"
            style={{ backgroundColor: ad.accentColor || '#22C55E' }}
          >
            <Text className="text-white text-xs font-semibold">{ad.ctaText}</Text>
          </View>
          <View className="ml-2 flex-row items-center">
            <Ionicons name="information-circle-outline" size={12} color="#9CA3AF" />
            <Text className="text-[9px] text-neutral-400 ml-0.5">Ad</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};
