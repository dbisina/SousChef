import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useShareIntentStore } from '@/stores/shareIntentStore';
import { Screen, useColor } from '@/components/ui';

/**
 * Handles souschef://share?url=<encoded_url> deep links from the iOS Share Extension.
 * Captures the shared URL, stores it, and redirects to the home screen where
 * the import modal will open automatically.
 */
function Spinner() {
  const accent = useColor('accent');
  return <ActivityIndicator size="large" color={accent} />;
}

export default function ShareScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string }>();
  const { setSharedURL } = useShareIntentStore();

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
    <Screen bare>
      <View className="flex-1 items-center justify-center">
        <Spinner />
      </View>
    </Screen>
  );
}
