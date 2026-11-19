// A recipe in progress, saved on the phone after every change so leaving the screen never loses it.
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RecipeDraft {
  title: string;
  imageUri: string | null;
  /** One ingredient per line, as typed. */
  ingredientsText: string;
  /** The whole method as typed or dictated. */
  stepsText: string;
  servings: number;
  prepTime: number;
  cookTime: number;
  category: string;
  cuisine: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  step: number;
  updatedAt: string;
}

export const emptyDraft = (): RecipeDraft => ({
  title: '',
  imageUri: null,
  ingredientsText: '',
  stepsText: '',
  servings: 4,
  prepTime: 15,
  cookTime: 30,
  category: 'dinner',
  cuisine: 'other',
  difficulty: 'medium',
  tags: [],
  step: 0,
  updatedAt: new Date(0).toISOString(),
});

const key = (userId: string) => `enplace.recipeDraft.v1.${userId}`;

/** Worth keeping: they typed something. A draft with only the defaults is not offered back. */
export const hasContent = (d: RecipeDraft): boolean =>
  Boolean(d.title.trim() || d.imageUri || d.ingredientsText.trim() || d.stepsText.trim());

export async function loadDraft(userId: string): Promise<RecipeDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RecipeDraft>;
    const draft = { ...emptyDraft(), ...parsed };
    return hasContent(draft) ? draft : null;
  } catch {
    return null; // storage or the saved text is unreadable: start fresh
  }
}

export async function saveDraft(userId: string, draft: RecipeDraft): Promise<void> {
  try {
    if (!hasContent(draft)) {
      await AsyncStorage.removeItem(key(userId));
      return;
    }
    await AsyncStorage.setItem(key(userId), JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }));
  } catch {
    // Saving the draft is a convenience; the recipe form still works without it.
  }
}

export async function clearDraft(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(userId));
  } catch {
    // nothing to do
  }
}
