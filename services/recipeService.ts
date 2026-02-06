import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  generateId,
} from '@/lib/firebase';
import {
  uploadImage,
  deleteImageByUrl,
  isCloudinaryUrl,
} from '@/lib/cloudinary';
import { deleteImage as deleteFirebaseImage } from '@/lib/firebase';
import { Recipe, RecipeFormData, Ingredient, RecipeFilters } from '@/types';
import { calculateNutrition, calculateIngredientCalories } from '@/lib/utils';

const RECIPES_COLLECTION = 'recipes';

// Create a new recipe
export const createRecipe = async (
  data: RecipeFormData,
  imageUri: string,
  authorId: string,
  authorName: string,
  isOfficial: boolean = false
): Promise<string> => {
  const recipeId = generateId();

  // Upload image to Cloudinary
  const folder = isOfficial ? 'souschef/recipes/official' : `souschef/recipes/${authorId}`;
  const imageURL = await uploadImage(imageUri, folder);

  // Calculate calories for each ingredient
  const ingredientsWithCalories: Ingredient[] = data.ingredients.map((ing) => ({
    ...ing,
    calories: calculateIngredientCalories(ing.name, ing.amount, ing.unit),
  }));

  // Calculate total nutrition
  const nutrition = calculateNutrition(ingredientsWithCalories, data.servings);

  const recipeData: Recipe = {
    id: recipeId,
    title: data.title,
    description: data.description,
    imageURL,
    youtubeURL: data.youtubeURL || undefined,
    authorId,
    authorName,
    isOfficial,
    category: data.category,
    cuisine: data.cuisine,
    difficulty: data.difficulty,
    prepTime: data.prepTime,
    cookTime: data.cookTime,
    servings: data.servings,
    ingredients: ingredientsWithCalories,
    instructions: data.instructions,
    nutrition,
    tags: data.tags,
    likes: 0,
    createdAt: Timestamp.now(),
  };

  await setDoc(doc(db, RECIPES_COLLECTION, recipeId), recipeData);
  return recipeId;
};

// Get a single recipe by ID
export const getRecipeById = async (id: string): Promise<Recipe | null> => {
  const docSnap = await getDoc(doc(db, RECIPES_COLLECTION, id));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Recipe;
  }
  return null;
};

// Get all recipes with optional filters
export const getRecipes = async (filters?: RecipeFilters): Promise<Recipe[]> => {
  let q = query(collection(db, RECIPES_COLLECTION), orderBy('createdAt', 'desc'));

  if (filters) {
    const constraints: Parameters<typeof query>[1][] = [];

    if (filters.category) {
      constraints.push(where('category', '==', filters.category));
    }
    if (filters.cuisine) {
      constraints.push(where('cuisine', '==', filters.cuisine));
    }
    if (filters.difficulty) {
      constraints.push(where('difficulty', '==', filters.difficulty));
    }
    if (filters.isOfficial !== undefined) {
      constraints.push(where('isOfficial', '==', filters.isOfficial));
    }

    constraints.push(orderBy('createdAt', 'desc'));
    q = query(collection(db, RECIPES_COLLECTION), ...constraints);
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Recipe[];
};

// Get recipes by user
export const getRecipesByUser = async (userId: string): Promise<Recipe[]> => {
  const q = query(
    collection(db, RECIPES_COLLECTION),
    where('authorId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Recipe[];
};

// Get official/chef recipes
export const getOfficialRecipes = async (): Promise<Recipe[]> => {
  const q = query(
    collection(db, RECIPES_COLLECTION),
    where('isOfficial', '==', true),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Recipe[];
};

// Get popular recipes (by likes)
export const getPopularRecipes = async (count: number = 10): Promise<Recipe[]> => {
  const q = query(
    collection(db, RECIPES_COLLECTION),
    orderBy('likes', 'desc'),
    limit(count)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Recipe[];
};

// Update a recipe
export const updateRecipe = async (
  id: string,
  data: Partial<RecipeFormData>,
  newImageUri?: string
): Promise<void> => {
  const updateData: Partial<Recipe> = { ...data } as Partial<Recipe>;

  // If there's a new image, upload it to Cloudinary
  if (newImageUri) {
    updateData.imageURL = await uploadImage(newImageUri, `souschef/recipes/${id}`);
  }

  // Handle youtubeURL update (convert empty string to undefined for deletion)
  if ('youtubeURL' in data) {
    updateData.youtubeURL = data.youtubeURL || undefined;
  }

  // Recalculate nutrition if ingredients changed
  if (data.ingredients && data.servings) {
    const ingredientsWithCalories: Ingredient[] = data.ingredients.map((ing) => ({
      ...ing,
      calories: calculateIngredientCalories(ing.name, ing.amount, ing.unit),
    }));
    updateData.ingredients = ingredientsWithCalories;
    updateData.nutrition = calculateNutrition(ingredientsWithCalories, data.servings);
  }

  await updateDoc(doc(db, RECIPES_COLLECTION, id), updateData);
};

// Delete a recipe
export const deleteRecipe = async (id: string): Promise<void> => {
  // Get the recipe to delete its image
  const recipe = await getRecipeById(id);
  if (recipe?.imageURL) {
    // Handle both Cloudinary and Firebase Storage images
    if (isCloudinaryUrl(recipe.imageURL)) {
      await deleteImageByUrl(recipe.imageURL);
    } else {
      await deleteFirebaseImage(recipe.imageURL);
    }
  }

  await deleteDoc(doc(db, RECIPES_COLLECTION, id));
};

// Search recipes by text
export const searchRecipes = async (searchQuery: string): Promise<Recipe[]> => {
  // Firestore doesn't support full-text search natively
  // For production, use Algolia, Elasticsearch, or Firebase Extensions
  // This is a simple client-side filter
  const allRecipes = await getRecipes();
  const query = searchQuery.toLowerCase();

  return allRecipes.filter(
    (recipe) =>
      recipe.title.toLowerCase().includes(query) ||
      recipe.description.toLowerCase().includes(query) ||
      recipe.tags.some((tag) => tag.toLowerCase().includes(query)) ||
      recipe.ingredients.some((ing) => ing.name.toLowerCase().includes(query))
  );
};

// Get recipes that can be made with given ingredients
export const getRecipesByIngredients = async (
  ingredientNames: string[]
): Promise<{ recipe: Recipe; matchScore: number }[]> => {
  const allRecipes = await getRecipes();
  const normalizedIngredients = ingredientNames.map((i) => i.toLowerCase());

  const scored = allRecipes.map((recipe) => {
    const recipeIngredients = recipe.ingredients
      .filter((i) => !i.optional)
      .map((i) => i.name.toLowerCase());

    const matchedCount = recipeIngredients.filter((ri) =>
      normalizedIngredients.some(
        (ni) => ri.includes(ni) || ni.includes(ri)
      )
    ).length;

    const matchScore = (matchedCount / recipeIngredients.length) * 100;
    return { recipe, matchScore };
  });

  // Sort by match score and filter out low matches
  return scored
    .filter((s) => s.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);
};
