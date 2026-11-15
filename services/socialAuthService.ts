import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import {
  auth,
  db,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from '@/lib/firebase';
import { User, UserRole } from '@/types';
import { apiEnabled } from '@/lib/api';
import { apiSocialSignIn, authViaFirebase, firebaseSocialSignIn, friendlyApiError } from '@/services/authApi';

WebBrowser.maybeCompleteAuthSession();

// Google OAuth client IDs - these should come from environment variables
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';

export interface SocialAuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (
  idToken: string | null,
  accessToken: string | null
): Promise<SocialAuthResult> => {
  try {
    if (!idToken) {
      return { success: false, error: 'No ID token received from Google' };
    }

    // With a server address set, the server checks the token and keeps the account (no Firebase involved).
    if (apiEnabled()) {
      // Firebase accounts: sign in with Firebase, then trade the token. Otherwise the server checks Google's token itself.
      if (authViaFirebase()) return { success: true, user: await firebaseSocialSignIn(GoogleAuthProvider.credential(idToken, accessToken)) };
      return { success: true, user: await apiSocialSignIn('google', idToken) };
    }

    // Create credential from tokens
    const credential = GoogleAuthProvider.credential(idToken, accessToken);

    // Sign in to Firebase
    const userCredential = await signInWithCredential(auth, credential);
    const firebaseUser = userCredential.user;

    // Check if user exists in Firestore
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

    let userData: User;

    if (userDoc.exists()) {
      userData = { id: userDoc.id, ...userDoc.data() } as User;
    } else {
      // Create new user document - omit photoURL if not available (Firestore rejects undefined)
      userData = {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || 'User',
        ...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL } : {}),
        role: 'user' as UserRole,
        createdAt: Timestamp.now(),
        savedRecipes: [],
        dietaryPreferences: [],
        allergies: [],
        healthConditions: [],
        recipeCount: 0,
        totalLikes: 0,
      };
      await setDoc(doc(db, 'users', firebaseUser.uid), userData);
    }

    return { success: true, user: userData };
  } catch (error) {
    console.error('Google sign in error:', error);
    const message = apiEnabled() ? friendlyApiError(error) : error instanceof Error ? error.message : 'Google sign in failed';
    return { success: false, error: message };
  }
};

/**
 * Sign in with Apple
 */
export const signInWithApple = async (): Promise<SocialAuthResult> => {
  try {
    // Check if Apple Authentication is available
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      return { success: false, error: 'Apple Sign In is not available on this device' };
    }

    // Generate a random nonce and hash it for Apple/Firebase
    const rawNonce = generateNonce(32);
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );

    // Request Apple credentials with the hashed nonce
    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    // Create Firebase credential
    const { identityToken, fullName, email } = appleCredential;

    if (!identityToken) {
      return { success: false, error: 'No identity token received from Apple' };
    }

    if (apiEnabled()) {
      const name = fullName ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() : '';
      if (authViaFirebase()) {
        const credential = new OAuthProvider('apple.com').credential({ idToken: identityToken, rawNonce });
        return { success: true, user: await firebaseSocialSignIn(credential, name || undefined) };
      }
      return { success: true, user: await apiSocialSignIn('apple', identityToken, name || undefined) };
    }

    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({
      idToken: identityToken,
      rawNonce, // Pass the raw (unhashed) nonce to Firebase
    });

    // Sign in to Firebase
    const userCredential = await signInWithCredential(auth, credential);
    const firebaseUser = userCredential.user;

    // Check if user exists in Firestore
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

    let userData: User;

    if (userDoc.exists()) {
      userData = { id: userDoc.id, ...userDoc.data() } as User;

      // Update displayName if user was created with 'User' placeholder and Apple now provides a real name
      if (userData.displayName === 'User' && fullName) {
        const newDisplayName = `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim();
        if (newDisplayName && newDisplayName !== 'User') {
          userData.displayName = newDisplayName;
          await setDoc(doc(db, 'users', firebaseUser.uid), { displayName: newDisplayName }, { merge: true });
        }
      }
    } else {
      // Build display name from Apple response
      const displayName = fullName
        ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() || firebaseUser.displayName || 'User'
        : firebaseUser.displayName || 'User';

      // Create new user document - omit photoURL if not available (Firestore rejects undefined)
      userData = {
        id: firebaseUser.uid,
        email: email || firebaseUser.email || '',
        displayName,
        ...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL } : {}),
        role: 'user' as UserRole,
        createdAt: Timestamp.now(),
        savedRecipes: [],
        dietaryPreferences: [],
        allergies: [],
        healthConditions: [],
        recipeCount: 0,
        totalLikes: 0,
      };
      await setDoc(doc(db, 'users', firebaseUser.uid), userData);
    }

    return { success: true, user: userData };
  } catch (error: any) {
    // Handle user cancellation
    if (error.code === 'ERR_CANCELED' || error.code === 'ERR_REQUEST_CANCELED') {
      return { success: false, error: 'cancelled' };
    }

    console.error('Apple sign in error:', error);
    const message = apiEnabled() ? friendlyApiError(error) : error instanceof Error ? error.message : 'Apple sign in failed';
    return { success: false, error: message };
  }
};

/**
 * Hook to use Google authentication
 */
export const useGoogleAuth = () => {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  return {
    request,
    response,
    promptAsync,
    isReady: !!request,
  };
};

/**
 * Check if Apple Sign In is available
 */
export const isAppleSignInAvailable = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    return false;
  }
  return AppleAuthentication.isAvailableAsync();
};

/**
 * Get the Google Auth config for manual setup
 */
export const getGoogleAuthConfig = () => ({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
  androidClientId: GOOGLE_ANDROID_CLIENT_ID,
});

/**
 * Generate a random nonce string for Apple Sign-In
 */
const generateNonce = (length: number): string => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const values = Crypto.getRandomBytes(length);
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
};
