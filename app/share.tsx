import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useShareIntentStore } from '@/stores/shareIntentStore';
import { useThemeColors } from '@/stores/themeStore';

/**
 * Handles souschef://share?url=<encoded_url> deep links from the iOS Share Extension.
 * Captures the shared URL, stores it, and redirects to the home screen where
 * the import modal will open automatically.
 */
export default function ShareScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string }>();
  const { setSharedURL } = useShareIntentStore();
  const colors = useThemeColors();

  useEffect(() => {
    if (params.url) {
      try {
        const decoded = decodeURIComponent(params.url);
        setSharedURL(decoded);
      } catch {
        setSharedURL(params.url);
      }
    }
    // Redirect to home screen where the import modal will pick up the shared URL
    router.replace('/(tabs)');
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}
