import { useEffect, useCallback, useState } from 'react';
import { useCookbookStore } from '@/stores/cookbookStore';
import { useAuthStore } from '@/stores/authStore';
import { Cookbook, Recipe } from '@/types';

// Main hook for cookbooks list
export const useCookbooks = () => {
  const {
    cookbooks,
    isLoading,
    error,
    fetchCookbooks,
    likeCookbook,
    unlikeCookbook,
    saveCookbook,
    unsaveCookbook,
  } = useCookbookStore();

  const { user } = useAuthStore();

  // Load cookbooks on mount
  useEffect(() => {
    fetchCookbooks();
  }, []);

  // Refresh cookbooks
  const refresh = useCallback(() => {
    fetchCookbooks();
  }, [fetchCookbooks]);

  // Check if cookbook is saved by current user
  const isCookbookSaved = useCallback(
    (cookbookId: string) => {
      return user?.savedCookbooks?.includes(cookbookId) || false;
    },
    [user]
  );

  // Toggle save/unsave
  const toggleSave = useCallback(
    async (cookbookId: string) => {
      if (!user) return;
      if (isCookbookSaved(cookbookId)) {
        await unsaveCookbook(cookbookId, user.id);
      } else {
        await saveCookbook(cookbookId, user.id);
      }
    },
    [user, isCookbookSaved, saveCookbook, unsaveCookbook]
  );

  // Toggle like
  const toggleLike = useCallback(
    async (cookbookId: string) => {
      if (!user) return;
      await likeCookbook(cookbookId);
    },
    [user, likeCookbook]
  );

  return {
    cookbooks,
    isLoading,
    error,
    refresh,
    toggleSave,
    toggleLike,
    isCookbookSaved,
  };
};

// Hook for a single cookbook with its recipes
export const useCookbook = (cookbookId: string) => {
  const {
    currentCookbook,
    currentCookbookRecipes,
    isLoading,
    error,
    fetchCookbookById,
    likeCookbook,
    saveCookbook,
    unsaveCookbook,
  } = useCookbookStore();

  const { user } = useAuthStore();

  useEffect(() => {
    if (cookbookId) {
      fetchCookbookById(cookbookId);
    }
  }, [cookbookId]);

  const isSaved = user?.savedCookbooks?.includes(cookbookId) || false;

  const toggleSave = useCallback(async () => {
    if (!user) return;
    if (isSaved) {
      await unsaveCookbook(cookbookId, user.id);
    } else {
      await saveCookbook(cookbookId, user.id);
    }
  }, [user, isSaved, cookbookId, saveCookbook, unsaveCookbook]);

  const handleLike = useCallback(async () => {
    if (!user) return;
    await likeCookbook(cookbookId);
  }, [user, cookbookId, likeCookbook]);

  return {
    cookbook: currentCookbook,
    recipes: currentCookbookRecipes,
    isLoading,
    error,
    isSaved,
    toggleSave,
    handleLike,
    refetch: () => fetchCookbookById(cookbookId),
  };
};

// Hook for user's saved cookbooks
export const useSavedCookbooks = () => {
  const { fetchCookbookRecipes } = useCookbookStore();
  const { user } = useAuthStore();
  const [cookbooks, setCookbooks] = useState<Cookbook[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchSaved = async () => {
      if (!user?.savedCookbooks?.length) {
        setCookbooks([]);
        return;
      }

      setIsLoading(true);
      try {
        const { db, doc, getDoc, COLLECTIONS } = await import('@/lib/firebase');
        const savedCookbooks: Cookbook[] = [];

        for (const id of user.savedCookbooks) {
          const cookbookDoc = await getDoc(doc(db, COLLECTIONS.COOKBOOKS, id));
          if (cookbookDoc.exists()) {
            savedCookbooks.push({ id: cookbookDoc.id, ...cookbookDoc.data() } as Cookbook);
          }
        }

        setCookbooks(savedCookbooks);
      } catch (error) {
        console.error('Error fetching saved cookbooks:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSaved();
  }, [user?.savedCookbooks]);

  return { cookbooks, isLoading };
};

// Hook for featured cookbooks (for home screen)
export const useFeaturedCookbooks = (maxCount: number = 5) => {
  const { cookbooks, isLoading, error, fetchCookbooks } = useCookbookStore();

  useEffect(() => {
    fetchCookbooks();
  }, []);

  // Return top cookbooks by likes
  const featuredCookbooks = cookbooks
    .slice()
    .sort((a, b) => b.likes - a.likes)
    .slice(0, maxCount);

  return {
    cookbooks: featuredCookbooks,
    isLoading,
    error,
    refresh: fetchCookbooks,
  };
};
