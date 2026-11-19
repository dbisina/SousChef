// Curated cookbooks: collections of recipes written by enplace staff. Dates are ISO strings.

export interface CookbookSummary {
  id: string;
  title: string;
  description: string;
  coverImageUrl: string;
  category: string | null;
  recipeCount: number;
  likeCount: number;
  saveCount: number;
  createdAt: string;
}

export interface Cookbook extends CookbookSummary {
  published: boolean;
  updatedAt: string;
  /** What the signed-in person has done with it; null when nobody is signed in. */
  viewer: { liked: boolean; saved: boolean } | null;
}

export interface CreateCookbookRequest {
  title: string;
  description?: string;
  coverImageUrl: string;
  category?: string;
  /** In the order they should appear. */
  recipeIds: string[];
  /** Default true. */
  published?: boolean;
}

export type UpdateCookbookRequest = Partial<Omit<CreateCookbookRequest, 'category'>> & { category?: string | null };
