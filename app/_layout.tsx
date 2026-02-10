import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { onAuthStateChanged } from 'firebase/auth';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import { useShareIntentStore } from '@/stores/shareIntentStore';
import { useThemeStore, useThemeColors } from '@/stores/themeStore';
import { ThemeProvider } from '@/components/ThemeProvider';
import { registerForPushNotifications, clearBadge } from '@/services/notificationService';
import { parseShareURL, onShareURL, getSharedURL } from '@/lib/shareExtension';

import '../global.css';

// Extract a URL from shared text (may contain surrounding text)
const extractURLFromText = (text: string): string | null => {
  // First try souschef:// scheme (from Share Extension)
  const shareExtURL = parseShareURL(text);
  if (shareExtURL) return shareExtURL;
  // Then try plain URL extraction
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  return urlMatch ? urlMatch[0] : null;
};

export default function RootLayout() {
  const { isInitialized, setUser, fetchUserData, setInitialized } = useAuthStore();
  const { setSharedURL } = useShareIntentStore();
  const colors = useThemeColors();
  const notificationListener = useRef<Notifications.EventSubscription>(null);
  const responseListener = useRef<Notifications.EventSubscription>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await fetchUserData(firebaseUser.uid);
        setUser(userData);

        // Register for push notifications when user signs in
        registerForPushNotifications(firebaseUser.uid);
      } else {
        setUser(null);
      }
      setInitialized(true);
    });

    return () => unsubscribe();
  }, []);

  // Handle push notification listeners
  useEffect(() => {
    // Clear badge on app launch
    clearBadge();

    // Listener for notifications received while app is foregrounded
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log('Notification received:', notification.request.content.title);
      });

    // Listener for when user taps a notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        // Navigate based on notification type
        if (data?.type === 'pantry_expiry') {
          // Navigate to pantry tab
        } else if (data?.type === 'meal_reminder') {
          // Navigate to meal plan tab
        }
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  // Handle incoming shared URLs (including from iOS Share Extension)
  useEffect(() => {
    // Check for URL that launched the app (deep link or share extension)
    const handleInitialURL = async () => {
      // Check Share Extension bridge first
      const shareExtURL = await getSharedURL();
      if (shareExtURL) {
        setSharedURL(shareExtURL);
        return;
      }

      // Then check standard deep links
      const initialURL = await Linking.getInitialURL();
      if (initialURL) {
        const extracted = extractURLFromText(initialURL);
        if (extracted) {
          setSharedURL(extracted);
        }
      }
    };

    handleInitialURL();

    // Listen for incoming URLs while app is running (Linking + Share Extension)
    const subscription = Linking.addEventListener('url', (event) => {
      const extracted = extractURLFromText(event.url);
      if (extracted) {
        setSharedURL(extracted);
      }
    });

    // Also listen specifically for share extension URLs
    const unsubShare = onShareURL((url) => {
      setSharedURL(url);
    });

    return () => {
      subscription.remove();
      unsubShare();
    };
  }, []);

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
      <StatusBar style={colors.statusBarStyle} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="auth/login"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="auth/register"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="recipe/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="cook/[id]"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="admin/add-recipe"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="admin/seed"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="settings/edit-profile"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="settings/notifications"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="settings/dietary"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="settings/appearance"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="settings/analytics"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="settings/voice"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="settings/help"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="settings/terms"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="settings/privacy"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="subscription"
          options={{
            headerShown: true,
            title: 'Subscription',
          }}
        />
        <Stack.Screen
          name="cookbook/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="want-to-cook"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="cookbook-library"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="shelf-cookbook/[id]"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="shelf-recipe/[id]"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="mealplan/shopping"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="mealplan/waste"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="share"
          options={{
            headerShown: false,
            animation: 'none',
          }}
        />
      </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
