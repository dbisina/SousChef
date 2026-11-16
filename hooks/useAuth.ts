import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import { isOnboardingComplete } from '@/app/onboarding';
import { isDesignReview } from '@/lib/designReview';
import { apiEnabled, onApiSignedOut } from '@/lib/api';
import { useSocialStore } from '@/stores/socialStore';
import { useMessageStore } from '@/stores/messageStore';
import { useHealthStore } from '@/stores/healthStore';
import { usePlayStore } from '@/stores/playStore';

// Hook to handle auth state changes and protected routes
export const useAuth = () => {
  const {
    user,
    isLoading,
    isInitialized,
    error,
    setUser,
    setInitialized,
    signUp,
    signIn,
    signOut,
    fetchUserData,
    updateUserProfile,
  } = useAuthStore();

  const router = useRouter();
  const segments = useSegments();

  // With a server address set, accounts live on the SousChef server: bring back the saved sign-in, and go to the
  // sign-in screen if the server ever ends it.
  useEffect(() => {
    if (isDesignReview || !apiEnabled()) return;
    onApiSignedOut(() => setUser(null));
    void useAuthStore.getState().restoreSession();
    return () => onApiSignedOut(null);
  }, []);

  // Server mode: once somebody is signed in, load their feed and conversations (and clear them on sign-out).
  const signedInId = user?.id;
  useEffect(() => {
    if (isDesignReview || !apiEnabled()) return;
    if (!signedInId) {
      useMessageStore.getState().stopLive(); // signed out: close the live connection and forget the conversations
      useHealthStore.getState().clearLocal(); // and nothing of someone's health stays on the phone for the next person
      usePlayStore.setState({ daily: null, serverDaily: null, round: null, playError: null });
      return;
    }
    void useSocialStore.getState().loadFromServer();
    void useMessageStore.getState().loadFromServer();
    void useHealthStore.getState().loadFromServer();
    void usePlayStore.getState().loadDaily();
  }, [signedInId]);

  // Listen to Firebase auth state changes
  useEffect(() => {
    if (isDesignReview || apiEnabled()) return; // review mode: stay a pre-initialised guest
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in, fetch their data from Firestore
        const userData = await fetchUserData(firebaseUser.uid);
        setUser(userData);
      } else {
        // User is signed out
        setUser(null);
      }
      setInitialized(true);
    });

    return () => unsubscribe();
  }, []);

  // Handle protected routes
  useEffect(() => {
    if (isDesignReview || !isInitialized) return; // review mode: no route guard

    const inAuthGroup = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';

    if (!user && !inAuthGroup && !inOnboarding) {
      // Not signed in — check if onboarding is done
      isOnboardingComplete().then((done) => {
        if (!done) {
          router.replace('/onboarding');
        } else {
          router.replace('/auth/login');
        }
      });
    } else if (user && (inAuthGroup || inOnboarding)) {
      // Signed in and on auth screen, redirect to home
      router.replace('/(tabs)');
    }
  }, [user, segments, isInitialized]);

  return {
    user,
    isLoading,
    isInitialized,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isChef: user?.role === 'chef' || user?.role === 'admin',
    error,
    signUp,
    signIn,
    signOut,
    updateUserProfile,
  };
};

// Hook for protected screens (throws if not authenticated)
export const useRequireAuth = () => {
  const auth = useAuth();

  if (!auth.isInitialized) {
    return { ...auth, isReady: false };
  }

  if (!auth.isAuthenticated) {
    return { ...auth, isReady: false };
  }

  return { ...auth, isReady: true };
};

// Hook for admin-only screens
export const useRequireAdmin = () => {
  const auth = useRequireAuth();

  if (!auth.isReady) {
    return { ...auth, hasAccess: false };
  }

  return { ...auth, hasAccess: auth.isAdmin || auth.isChef };
};
