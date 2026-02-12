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
  updateUserProfile: (updates: Partial<User>) => Promise<void>;
  deleteAccount: () => Promise<void>;
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
    };
    set({ user: guestUser, isGuest: true, isInitialized: true });
  },

  signUp: async (email, password, displayName) => {
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

  deleteAccount: async () => {
    const { user } = get();
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
