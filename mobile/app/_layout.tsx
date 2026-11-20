import { useEffect, useRef, useState } from 'react';
import { Stack, router as rootRouter, useRouter } from 'expo-router';
import { installNavGuard } from '@/lib/navGuard';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import { isOnboardingComplete } from '@/app/onboarding';
import { applyPendingUpdate } from '@/lib/otaUpdate';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { BrandSplash } from '@/components/ui/BrandSplash';
import { Satisfy_400Regular } from '@expo-google-fonts/satisfy';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { onAuthStateChanged } from 'firebase/auth';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import { apiEnabled } from '@/lib/api';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useShareIntentStore } from '@/stores/shareIntentStore';
import { useThemeStore, useThemeColors } from '@/stores/themeStore';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toast } from '@/components/ui';
import { registerForPushNotifications, clearBadge } from '@/services/notificationService';
import { parseShareURL, onShareURL, getSharedURL } from '@/lib/shareExtension';
import { isDesignReview } from '@/lib/designReview';
import { bootDesignReview } from '@/lib/designReviewBoot';
import { DesignReviewFrame } from '@/lib/DesignReviewFrame';

import '../global.css';


// Initialize i18n (must be before any component renders)
import '@/lib/i18n';

// Design-review mode (web, build-time flag): guest everywhere, stores on window.__SC__. No-op otherwise.
bootDesignReview();

// Hold the native splash until fonts are ready (released in RootLayout).
SplashScreen.preventAutoHideAsync().catch(() => {});

// Extract a URL from shared text (may contain surrounding text)
const extractURLFromText = (text: string): string | null => {
  // First try souschef:// scheme (from Share Extension)
  const shareExtURL = parseShareURL(text);
  if (shareExtURL) return shareExtURL;
  // Then try plain URL extraction
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  return urlMatch ? urlMatch[0] : null;
};

// Wrapped before any screen renders, so every router.push/replace in the app ignores accidental repeats (double taps).
installNavGuard(rootRouter as unknown as Parameters<typeof installNavGuard>[0]);

export default function RootLayout() {
  const { isInitialized, setUser, fetchUserData, setInitialized } = useAuthStore();
  const { setSharedURL } = useShareIntentStore();
  const colors = useThemeColors();
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Satisfy_400Regular,
  });
  const fontsReady = fontsLoaded || !!fontError;
  // The opening animation plays once per launch, and never ends before the app is ready.
  const [splashDone, setSplashDone] = useState(isDesignReview);
  const notificationListener = useRef<Notifications.EventSubscription>(null);
  const responseListener = useRef<Notifications.EventSubscription>(null);

  useEffect(() => {
    // Review mode: auth is pre-initialised as a guest; a real listener would reset the injected user.
    if (isDesignReview) return;
    if (apiEnabled()) {
      // Accounts live on the enplace server. The old Firebase listener below loads the person from Firestore (empty in the
      // new project) and then overwrote the real sign-in with "signed out", which is how people got logged out at random and
      // sat on the splash waiting for it. Restore the saved sign-in instead, and never hold the splash for more than a few seconds.
      void useAuthStore.getState().restoreSession();
      const patience = setTimeout(() => setInitialized(true), 8000);
      return () => clearTimeout(patience);
    }
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
      // Review mode: on web the page URL itself would be read as a shared recipe link.
      if (isDesignReview) return;
      // On web the launch URL is just the page address (never a shared link), so it must not open the import screen.
      if (Platform.OS === 'web') return;
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
      if (Platform.OS === 'web') return; // page navigation, not a shared link
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

  // Initialize RevenueCat on app launch
  useEffect(() => {
    const initSubscription = async () => {
      // Initialize anonymously first, will identify when user logs in
      await useSubscriptionStore.getState().initialize();
    };
    initSubscription();
  }, []);

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);

  // Over-the-air fixes: pick up a newer JavaScript bundle for this build while the opening animation covers the app.
  useEffect(() => {
    if (isDesignReview) return;
    void applyPendingUpdate();
  }, []);

  // First screen: decide it before anyone sees the app. Without this the home tab painted for a moment and then snapped to
  // onboarding or sign-in. The app is mounted underneath the opening animation, the first redirect happens while it is
  // covered, and the cover only lifts once that has settled.
  const startRouter = useRouter();
  const [startReady, setStartReady] = useState(isDesignReview);
  useEffect(() => {
    if (isDesignReview || !isInitialized || startReady) return;
    let alive = true;
    (async () => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) {
          const done = await isOnboardingComplete();
          startRouter.replace(done ? '/auth/login' : '/onboarding');
          await new Promise((r) => setTimeout(r, 250)); // let the navigation commit before the cover lifts
        }
      } catch {
        // Navigation not ready yet: the route guard in useAuth redirects as soon as it is.
      }
      if (alive) setStartReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [isInitialized, startReady]);

  if (!fontsReady) return null;

  const covered = !isInitialized || !startReady || !splashDone;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <DesignReviewFrame>
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
          name="user/[id]"
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
          name="settings/weight-loss"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="settings/language"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="subscription"
          options={{
            headerShown: false,
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
          name="create"
          options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: '#0B0B0B' } }}
        />
        <Stack.Screen name="import" options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="spools" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="story/[id]" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="google-auth" options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen
          name="share"
          options={{
            headerShown: false,
            animation: 'none',
          }}
        />
      </Stack>
      <Toast />
      </ThemeProvider>
      </DesignReviewFrame>
      {covered ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="auto">
          <BrandSplash ready={isInitialized && startReady} onDone={() => setSplashDone(true)} />
        </View>
      ) : null}
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
