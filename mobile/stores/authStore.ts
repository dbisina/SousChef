import { create } from 'zustand';
import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  Timestamp,
} from '@/lib/firebase';
import { User, UserRole } from '@/types';
import { getFriendlyAuthError } from '@/lib/utils';
import { apiEnabled } from '@/lib/api';
import {
  apiDeleteAccount,
  apiRequestPasswordReset,
  apiRestoreSession,
  apiSignIn,
  apiSignOut,
  apiSignUp,
  apiUpdateProfile,
  friendlyApiError,
} from '@/services/authApi';

/**
 * With EXPO_PUBLIC_API_URL set, accounts live on the SousChef server; without it everything here still uses Firebase.
 * Runs `work` against the server and turns any failure into the store's error message.
 */
async function viaApi<T>(set: (s: Partial<AuthState>) => void, work: () => Promise<T>): Promise<T> {
  set({ isLoading: true, error: null });
  try {
    return await work();
  } catch (error: unknown) {
    set({ error: friendlyApiError(error), isLoading: false });
    throw error;
  }
}

let restoring: Promise<void> | null = null;

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  isGuest: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;

  // Auth operations
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  fetchUserData: (uid: string) => Promise<User | null>;
  /** Server mode only: brings back the saved sign-in at launch. */
  restoreSession: () => Promise<void>;
  updateUserProfile: (updates: Partial<User>) => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
  continueAsGuest: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  isGuest: false,
  error: null,

  setUser: (user) => set({ user, isGuest: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setInitialized: (isInitialized) => set({ isInitialized }),

  continueAsGuest: () => {
    const guestUser: User = {
      id: 'guest-' + Date.now(),
      email: '',
      displayName: 'Guest Chef',
      role: 'user' as UserRole,
      createdAt: Timestamp.now(),
      savedRecipes: [],
      dietaryPreferences: [],
      allergies: [],
      healthConditions: [],
    };
    set({ user: guestUser, isGuest: true, isInitialized: true });
  },

  signUp: async (email, password, displayName) => {
    if (apiEnabled()) {
      const user = await viaApi(set, () => apiSignUp(email, password, displayName));
      set({ user, isLoading: false });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const { uid } = userCredential.user;

      // Update Firebase Auth profile
      await updateProfile(userCredential.user, { displayName });

      // Create user document in Firestore
      const userData: User = {
        id: uid,
        email,
        displayName,
        role: 'user' as UserRole,
        createdAt: Timestamp.now(),
        savedRecipes: [],
        dietaryPreferences: [],
        allergies: [],
        healthConditions: [],
        recipeCount: 0,
        totalLikes: 0,
      };

      await setDoc(doc(db, 'users', uid), userData);
      set({ user: userData, isLoading: false });
    } catch (error: unknown) {
      const message = getFriendlyAuthError(error);
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  signIn: async (email, password) => {
    if (apiEnabled()) {
      const user = await viaApi(set, () => apiSignIn(email, password));
      set({ user, isLoading: false });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      let userData = await get().fetchUserData(userCredential.user.uid);

      // If user document doesn't exist, create it
      if (!userData) {
        userData = {
          id: userCredential.user.uid,
          email: userCredential.user.email || email,
          displayName: userCredential.user.displayName || email.split('@')[0],
          role: 'user' as UserRole,
          createdAt: Timestamp.now(),
          savedRecipes: [],
          dietaryPreferences: [],
          allergies: [],
          healthConditions: [],
          recipeCount: 0,
          totalLikes: 0,
        };
        await setDoc(doc(db, 'users', userCredential.user.uid), userData);
      }

      set({ user: userData, isLoading: false });
    } catch (error: unknown) {
      const message = getFriendlyAuthError(error);
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  signOut: async () => {
    if (apiEnabled()) {
      await apiSignOut();
      set({ user: null, isLoading: false, error: null });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      await firebaseSignOut(auth);
      set({ user: null, isLoading: false });
    } catch (error: unknown) {
      const message = getFriendlyAuthError(error);
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  resetPassword: async (email) => {
    if (apiEnabled()) {
      await viaApi(set, () => apiRequestPasswordReset(email));
      set({ isLoading: false });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      await sendPasswordResetEmail(auth, email);
      set({ isLoading: false });
    } catch (error: unknown) {
      const message = getFriendlyAuthError(error);
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  restoreSession: async () => {
    // Several screens use the auth hook; the work is done once, however many ask (and not again once the app knows).
    if (get().isInitialized) return;
    restoring ??= (async () => {
      try {
        set({ user: await apiRestoreSession(), isGuest: false });
      } catch {
        // Offline at launch: keep whatever we have; the next request tries again.
      } finally {
        set({ isInitialized: true });
        restoring = null;
      }
    })();
    await restoring;
  },

  fetchUserData: async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() } as User;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  },

  updateUserProfile: async (updates) => {
    const { user } = get();
    if (!user) {
      throw new Error('No user logged in');
    }

    if (apiEnabled()) {
      const updated = await viaApi(set, () => apiUpdateProfile(updates));
      // Only what the server owns; lists the server does not send yet (saved recipes and the like) stay as they are.
      set({
        user: { ...user, displayName: updated.displayName, handle: updated.handle, bio: updated.bio, photoURL: updated.photoURL, bannerURL: updated.bannerURL, role: updated.role, isVerifiedChef: updated.isVerifiedChef },
        isLoading: false,
      });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const userRef = doc(db, 'users', user.id);
      await setDoc(userRef, updates, { merge: true });

      // Update local state
      set({ user: { ...user, ...updates }, isLoading: false });

      // Update Firebase Auth display name if changed
      if (updates.displayName && auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: updates.displayName });
      }
    } catch (error: unknown) {
      const message = getFriendlyAuthError(error);
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  deleteAccount: async (password) => {
    const { user } = get();
    if (apiEnabled()) {
      if (!user) throw new Error('No user logged in');
      await viaApi(set, () => apiDeleteAccount(password));
      set({ user: null, isLoading: false });
      return;
    }
    if (!user || !auth.currentUser) {
      throw new Error('No user logged in');
    }

    set({ isLoading: true, error: null });
    try {
      // Delete user document from Firestore
      await deleteDoc(doc(db, 'users', user.id));

      // Delete Firebase Auth account
      await deleteUser(auth.currentUser);

      set({ user: null, isLoading: false });
    } catch (error: unknown) {
      const message = getFriendlyAuthError(error);
      set({ error: message, isLoading: false });
      throw error;
    }
  },
}));
