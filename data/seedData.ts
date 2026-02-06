import { RecipeFormData, UserRole, PantryItemFormData } from '@/types';

// Extended interfaces for seeding
export interface SeedUser {
    id: string; // Fixed ID for seeding
    email: string;
    password?: string; // Password for Firebase Auth (only for real accounts)
    displayName: string;
    role: UserRole;
    photoURL?: string;
    subscriptionTier?: 'free' | 'premium' | 'pro';
    pantryItems?: PantryItemFormData[];
    createAuthAccount?: boolean; // Whether to create a real Firebase Auth account
}

export interface SeedRecipe extends RecipeFormData {
    id: string; // Fixed ID for seeding
    imageURL: string;
    seedAuthorId?: string; // ID of the SeedUser who owns this
}

export interface SeedCookbook {
    id: string; // Fixed ID for seeding
    title: string;
    description: string;
    coverImageURL: string;
    category: string;
    seedRecipeIndices: number[]; // Indices of recipes in SEED_RECIPES array
    seedAuthorId: string; // ID of the SeedUser who owns this
}

// 1. Seed Users
export const SEED_USERS: SeedUser[] = [
    {
        id: 'admin_souschef',
        email: 'admin@souschef.app',
        password: 'Admin123!',
        displayName: 'SousChef Admin',
        role: 'admin',
        photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=800&q=80',
        subscriptionTier: 'pro',
        createAuthAccount: true,
    },
    {
        id: 'chef_gordon',
        email: 'gordon@souschef.app',
        displayName: 'Gordon Ramsay',
        role: 'chef',
        photoURL: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=800&q=80',
        subscriptionTier: 'pro',
    },
    {
        id: 'chef_julia',
        email: 'julia@souschef.app',
        displayName: 'Julia Child',
        role: 'chef',
        photoURL: 'https://images.unsplash.com/photo-1595273670150-bd0c3c392e46?auto=format&fit=crop&w=800&q=80',
        subscriptionTier: 'pro',
    },
    {
        id: 'chef_jamie',
        email: 'jamie@souschef.app',
        displayName: 'Jamie Oliver',
        role: 'chef',
        photoURL: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=800&q=80',
        subscriptionTier: 'pro',
    },
    {
        id: 'user_premium',
        email: 'premium@souschef.app',
        displayName: 'Premium User',
        role: 'user',
        subscriptionTier: 'premium',
        photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
        pantryItems: [
            { name: 'Olive Oil', category: 'condiments', unit: 'tbsp', amount: 1 }, // Amount is arbitrary for "stock"
            { name: 'Chicken Breast', category: 'meat', unit: 'oz', amount: 16 },
            { name: 'Rice', category: 'grains', unit: 'cup', amount: 5 },
            { name: 'Onions', category: 'produce', unit: 'piece', amount: 3 },
            { name: 'Garlic', category: 'produce', unit: 'clove', amount: 10 },
        ]
    },
    {
        id: 'user_pro',
        email: 'pro@souschef.app',
        displayName: 'Pro User',
        role: 'user',
        subscriptionTier: 'pro',
        photoURL: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
        pantryItems: [
            { name: 'Avocado', category: 'produce', unit: 'piece', amount: 4 },
            { name: 'Sourdough Bread', category: 'grains', unit: 'loaf', amount: 1 },
            { name: 'Eggs', category: 'dairy', unit: 'dozen', amount: 1 },
            { name: 'Salmon Fillet', category: 'seafood', unit: 'lb', amount: 2 },
            { name: 'Asparagus', category: 'produce', unit: 'bunch', amount: 1 },
            { name: 'Lemon', category: 'produce', unit: 'piece', amount: 2 },
            { name: 'Quinoa', category: 'grains', unit: 'box', amount: 1 },
            { name: 'Chickpeas', category: 'canned', unit: 'can', amount: 2 },
            { name: 'Kale', category: 'produce', unit: 'bunch', amount: 1 },
            { name: 'Greek Yogurt', category: 'dairy', unit: 'tub', amount: 1 },
            { name: 'Berries', category: 'produce', unit: 'pack', amount: 2 },
        ]
    }
];

// 2. Seed Recipes
export const SEED_RECIPES: SeedRecipe[] = [
    // Breakfasts
    {
        id: 'recipe_avo_toast',
        title: 'Avocado Toast with Poached Egg',
        description: 'A classic breakfast favorite featuring creamy avocado, a perfectly poached egg, and a sprinkle of chili flakes on artisan sourdough bread.',
        category: 'breakfast',
        cuisine: 'american',
        difficulty: 'easy',
        prepTime: 10,
        cookTime: 5,
        servings: 1,
        imageURL: 'https://images.unsplash.com/photo-1525351484163-7529414395d8?auto=format&fit=crop&w=1000&q=80',
        seedAuthorId: 'chef_jamie',
        ingredients: [
            { name: 'Sourdough Bread', amount: 1, unit: 'slice', optional: false },
            { name: 'Ripe Avocado', amount: 0.5, unit: 'whole', optional: false },
            { name: 'Large Egg', amount: 1, unit: 'whole', optional: false },
            { name: 'Lemon Juice', amount: 1, unit: 'tsp', optional: true },
            { name: 'Red Chili Flakes', amount: 0.5, unit: 'tsp', optional: true },
        ],
        instructions: [
            'Toast the slice of sourdough bread.',
            'Poach the egg in simmering water for 3-4 minutes.',
            'Mash avocado with lemon juice, salt, and pepper.',
            'Spread on toast, top with egg, and garnish with chili flakes.',
        ],
        tags: ['breakfast', 'healthy', 'quick', 'vegetarian'],
    },
    {
        id: 'recipe_pancakes',
        title: 'Fluffy Blueberry Pancakes',
        description: 'Thick, fluffy, and bursting with fresh blueberries. Served with warm maple syrup.',
        category: 'breakfast',
        cuisine: 'american',
        difficulty: 'medium',
        prepTime: 15,
        cookTime: 15,
        servings: 4,
        imageURL: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?auto=format&fit=crop&w=1000&q=80',
        seedAuthorId: 'chef_julia',
        ingredients: [
            { name: 'Flour', amount: 2, unit: 'cups', optional: false },
            { name: 'Sugar', amount: 2, unit: 'tbsp', optional: false },
            { name: 'Baking Powder', amount: 2, unit: 'tsp', optional: false },
            { name: 'Milk', amount: 1.5, unit: 'cups', optional: false },
            { name: 'Blueberries', amount: 1, unit: 'cup', optional: false },
        ],
        instructions: [
            'Whisk dry ingredients together.',
            'Mix wet ingredients and combine with dry. Do not overmix.',
            'Fold in blueberries.',
            'Cook on a buttered griddle until golden brown on both sides.',
        ],
        tags: ['breakfast', 'sweet', 'family-favorite'],
    },

    // Lunch / Dinner
    {
        id: 'recipe_stir_fry',
        title: 'Classic Chicken Stir-Fry',
        description: 'A vibrant and healthy stir-fry loaded with colorful vegetables and tender chicken breast.',
        category: 'dinner',
        cuisine: 'chinese',
        difficulty: 'medium',
        prepTime: 20,
        cookTime: 10,
        servings: 2,
        imageURL: 'https://images.unsplash.com/photo-1603133872878-684f10821fcc?auto=format&fit=crop&w=1000&q=80',
        seedAuthorId: 'chef_gordon',
        ingredients: [
            { name: 'Chicken Breast', amount: 300, unit: 'g', optional: false },
            { name: 'Broccoli', amount: 1, unit: 'cup', optional: false },
            { name: 'Soy Sauce', amount: 3, unit: 'tbsp', optional: false },
        ],
        instructions: ['Stir fry veggies and chicken. Add sauce. Serve.'],
        tags: ['dinner', 'chinese', 'healthy', 'stir-fry'],
    },
    {
        id: 'recipe_risotto',
        title: 'Creamy Mushroom Risotto',
        description: 'Rich, creamy Italian rice dish with white wine and parmesan.',
        category: 'dinner',
        cuisine: 'italian',
        difficulty: 'hard',
        prepTime: 15,
        cookTime: 40,
        servings: 4,
        imageURL: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=1000&q=80',
        seedAuthorId: 'chef_gordon',
        ingredients: [
            { name: 'Arborio Rice', amount: 1.5, unit: 'cup', optional: false },
            { name: 'Mushrooms', amount: 300, unit: 'g', optional: false },
            { name: 'Vegetable Broth', amount: 5, unit: 'cup', optional: false },
        ],
        instructions: ['Sauté mushrooms. Toast rice. Add broth slowly. Stir in cheese.'],
        tags: ['italian', 'dinner', 'comfort-food', 'vegetarian'],
    },
    {
        id: 'recipe_tacos',
        title: 'Spicy Beef Tacos',
        description: 'Street-style beef tacos with fresh cilantro and onion.',
        category: 'dinner',
        cuisine: 'mexican',
        difficulty: 'medium',
        prepTime: 20,
        cookTime: 15,
        servings: 3,
        imageURL: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=1000&q=80',
        seedAuthorId: 'chef_jamie',
        ingredients: [
            { name: 'Ground Beef', amount: 500, unit: 'g', optional: false },
            { name: 'Taco Shells', amount: 6, unit: 'pieces', optional: false },
            { name: 'Cilantro', amount: 1, unit: 'bunch', optional: false },
        ],
        instructions: ['Cook beef with spices. Warm tortillas. Assemble tacos.'],
        tags: ['mexican', 'dinner', 'spicy'],
    },
    {
        id: 'recipe_salmon',
        title: 'Grilled Salmon with Asparagus',
        description: 'Fresh salmon fillets grilled to perfection with lemon butter asparagus.',
        category: 'dinner',
        cuisine: 'mediterranean',
        difficulty: 'medium',
        prepTime: 10,
        cookTime: 15,
        servings: 2,
        imageURL: 'https://images.unsplash.com/photo-1467003909585-2f8a7270028d?auto=format&fit=crop&w=1000&q=80',
        seedAuthorId: 'chef_gordon',
        ingredients: [
            { name: 'Salmon Fillet', amount: 2, unit: 'pieces', optional: false },
            { name: 'Asparagus', amount: 1, unit: 'bunch', optional: false },
            { name: 'Lemon', amount: 1, unit: 'whole', optional: false },
        ],
        instructions: ['Season salmon. Grill for 4 mins per side. Grill asparagus alongside.'],
        tags: ['healthy', 'dinner', 'seafood', 'keto'],
    },
    {
        id: 'recipe_buddha_bowl',
        title: 'Vegan Buddha Bowl',
        description: 'Nutrient-packed bowl with quinoa, roasted chickpeas, and avocado.',
        category: 'lunch',
        cuisine: 'other',
        difficulty: 'easy',
        prepTime: 20,
        cookTime: 25,
        servings: 1,
        imageURL: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1000&q=80',
        seedAuthorId: 'chef_jamie',
        ingredients: [
            { name: 'Quinoa', amount: 0.5, unit: 'cup', optional: false },
            { name: 'Chickpeas', amount: 1, unit: 'can', optional: false },
            { name: 'Kale', amount: 1, unit: 'cup', optional: false },
        ],
        instructions: ['Roast chickpeas. Cook quinoa. Massage kale. Assemble bowl.'],
        tags: ['vegan', 'lunch', 'healthy'],
    },

    // Desserts
    {
        id: 'recipe_lava_cake',
        title: 'Chocolate Lava Cake',
        description: 'Decadent individual chocolate cakes with a molten gooey center.',
        category: 'dessert',
        cuisine: 'french',
        difficulty: 'medium',
        prepTime: 15,
        cookTime: 12,
        servings: 2,
        imageURL: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=1000&q=80',
        seedAuthorId: 'chef_julia',
        ingredients: [
            { name: 'Dark Chocolate', amount: 100, unit: 'g', optional: false },
            { name: 'Butter', amount: 50, unit: 'g', optional: false },
            { name: 'Egg', amount: 1, unit: 'whole', optional: false },
        ],
        instructions: ['Melt chocolate/butter. Mux eggs/sugar. Combine. Bake 12 mins.'],
        tags: ['dessert', 'chocolate', 'baking'],
    },
    {
        id: 'recipe_tiramisu',
        title: 'Homemade Tiramisu',
        description: 'Classic Italian dessert with coffee-soaked ladyfingers and mascarpone cream.',
        category: 'dessert',
        cuisine: 'italian',
        difficulty: 'hard',
        prepTime: 40,
        cookTime: 0,
        servings: 6,
        imageURL: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=1000&q=80',
        seedAuthorId: 'chef_julia',
        ingredients: [
            { name: 'Mascarpone', amount: 500, unit: 'g', optional: false },
            { name: 'Ladyfingers', amount: 1, unit: 'pack', optional: false },
            { name: 'Espresso', amount: 1, unit: 'cup', optional: false },
        ],
        instructions: ['Whip mascarpone. Dip ladyfingers in coffee. Layer. Chill.'],
        tags: ['dessert', 'italian', 'no-bake'],
    },
    {
        id: 'recipe_smoothie_bowl',
        title: 'Berry Smoothie Bowl',
        description: 'Refreshing smoothie topped with fresh fruits and granola.',
        category: 'breakfast',
        cuisine: 'other',
        difficulty: 'easy',
        prepTime: 10,
        cookTime: 0,
        servings: 1,
        imageURL: 'https://images.unsplash.com/photo-1577805947697-89e18249d767?auto=format&fit=crop&w=1000&q=80',
        seedAuthorId: 'chef_jamie',
        ingredients: [
            { name: 'Mixed Berries', amount: 1, unit: 'cup', optional: false },
            { name: 'Yogurt', amount: 0.5, unit: 'cup', optional: false },
        ],
        instructions: ['Blend berries and yogurt. Top with granola.'],
        tags: ['breakfast', 'healthy', 'fruit'],
    }
];

// 3. Seed Cookbooks
export const SEED_COOKBOOKS: SeedCookbook[] = [
    {
        id: 'cookbook_gordon_masterclass',
        title: "Chef Gordon's Masterclass",
        description: "Essential recipes for the aspiring home chef, curated by Gordon himself.",
        coverImageURL: "https://images.unsplash.com/photo-1556910103-1c02745a30bf?auto=format&fit=crop&w=1000&q=80",
        category: "Masterclass",
        seedAuthorId: 'chef_gordon',
        seedRecipeIndices: [2, 3, 5], // Stir Fry, Risotto, Salmon
    },
    {
        id: 'cookbook_sweet_treats',
        title: "Sweet Treats & Baking",
        description: "Indulgent desserts and baked goods for your sweet tooth.",
        coverImageURL: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1000&q=80",
        category: "Baking",
        seedAuthorId: 'chef_julia',
        seedRecipeIndices: [1, 7, 8], // Pancakes, Lava Cake, Tiramisu
    },
    {
        id: 'cookbook_healthy_quick',
        title: "Healthy & Quick",
        description: "Nutritious meals ready in 30 minutes or less.",
        coverImageURL: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1000&q=80",
        category: "Healthy",
        seedAuthorId: 'chef_jamie',
        seedRecipeIndices: [0, 4, 6, 9], // Avo Toast, Tacos, Buddha Bowl, Smoothie
    }
];
