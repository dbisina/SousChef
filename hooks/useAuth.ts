import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import { isOnboardingComplete } from '@/app/onboarding';

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

  // Listen to Firebase auth state changes
  useEffect(() => {
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
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === 'auth';
    const inAdminGroup = segments[0] === 'admin';
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
    } else if (user && inAdminGroup && user.role !== 'admin' && user.role !== 'chef') {
      // Trying to access admin without permission
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
