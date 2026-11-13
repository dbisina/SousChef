import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useAdStore } from '@/stores/adStore';
import { FIXED } from '@/stores/themeStore';
import { FONT } from './fonts';
import { Tag } from './Chips';

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
  const { t } = useTranslation();
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
    <Animated.View entering={FadeIn.duration(300)} className={className}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${t('account.ads.advertisement', 'Advertisement')}: ${ad.title}`}
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
          <Tag label={t('account.ads.advertisement', 'Advertisement')} />
          <Text className="text-ink" numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: 15 }}>
            {ad.title}
          </Text>
          <Text className="text-muted" numberOfLines={1} style={{ fontFamily: FONT.sans, fontSize: 12 }}>
            {ad.subtitle}
          </Text>
        </View>
        <View
          className="items-center justify-center"
          style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: ad.accentColor || FIXED.accent }}
        >
          <Text style={{ fontFamily: FONT.sansMedium, fontSize: 12, color: FIXED.night }}>{ad.ctaText}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};
