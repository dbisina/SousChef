import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRecipeStore } from '@/stores/recipeStore';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui';
import { SEED_RECIPES, SEED_USERS, SEED_COOKBOOKS, SeedUser } from '@/data/seedData';
import { db, auth, doc, setDoc, collection, addDoc, Timestamp, createUserWithEmailAndPassword, updateProfile } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/firebase';
import { calculateNutrition, calculateIngredientCalories } from '@/lib/utils';

export default function SeedDataScreen() {
  const router = useRouter();
  const { createRecipe } = useRecipeStore();
  const { user: currentUser } = useAuthStore();
  
  const [isSeeding, setIsSeeding] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, message]);
  };

  const handleSeed = async () => {
    // Allow seeding if logged in OR if in dev mode
    if (!currentUser && !__DEV__) {
      Alert.alert('Error', 'You must be logged in to seed data.');
      return;
    }

    if (isSeeding) return;

    setIsSeeding(true);
    setLogs([]);
    setProgress(0);
    addLog('Starting comprehensive seed process...');

    let userCount = 0;
    let recipeCount = 0;
    let cookbookCount = 0;
    
    // Default to a system ID if not logged in (only happens in dev)
    const effectiveUserId = currentUser?.id || 'dev_admin_user';
    const effectiveUserName = currentUser?.displayName || 'Dev Admin';
    
    // Store created recipe IDs to link them to cookbooks
    // Maps index in SEED_RECIPES array -> Firestore ID
    const recipeIdMap: Record<number, string> = {};

    try {
      // 1. Seed Users
      addLog('\n--- Seeding Users ---');
      const totalSteps = SEED_USERS.length + SEED_RECIPES.length + SEED_COOKBOOKS.length;
      let currentStep = 0;

      for (const seedUser of SEED_USERS) {
        try {
          addLog(`Setting up user: ${seedUser.displayName}...`);

          let finalUserId = seedUser.id;

          // Create real Firebase Auth account if specified
          if (seedUser.createAuthAccount && seedUser.password) {
            try {
              addLog(`  - Creating Firebase Auth account...`);
              const userCredential = await createUserWithEmailAndPassword(
                auth,
                seedUser.email,
                seedUser.password
              );
              finalUserId = userCredential.user.uid;

              // Update display name in Auth
              await updateProfile(userCredential.user, {
                displayName: seedUser.displayName,
                photoURL: seedUser.photoURL,
              });

              addLog(`  - ✅ Auth account created (UID: ${finalUserId})`);
            } catch (authError: any) {
              if (authError.code === 'auth/email-already-in-use') {
                addLog(`  - ℹ️ Auth account already exists, using seed ID`);
              } else {
                throw authError;
              }
            }
          }

          // Create/Update User Doc
          await setDoc(doc(db, COLLECTIONS.USERS, finalUserId), {
            id: finalUserId,
            email: seedUser.email,
            displayName: seedUser.displayName,
            role: seedUser.role,
            photoURL: seedUser.photoURL,
            subscriptionTier: seedUser.subscriptionTier || 'free',
            createdAt: Timestamp.now(),
            savedRecipes: [],
            dietaryPreferences: [],
          });

          // Seed Pantry Items if any
          if (seedUser.pantryItems && seedUser.pantryItems.length > 0) {
              addLog(`  - Adding ${seedUser.pantryItems.length} pantry items...`);
              const pantryRef = collection(db, COLLECTIONS.USERS, seedUser.id, 'pantry');
              
              for (const item of seedUser.pantryItems) {
                  // Create a deterministic ID based on item name to avoid duplicates
                  const itemId = `pantry_${item.name.toLowerCase().replace(/\s+/g, '_')}`;
                  await setDoc(doc(pantryRef, itemId), {
                      id: itemId,
                      name: item.name,
                      category: item.category,
                      amount: item.amount,
                      unit: item.unit,
                      addedAt: Timestamp.now(),
                  });
              }
          }
          
          userCount++;
          addLog(`✅ Created/Updated user: ${seedUser.displayName}`);
        } catch (error) {
          console.error(error);
          addLog(`❌ Failed user: ${seedUser.displayName} - ${error instanceof Error ? error.message : String(error)}`);
        }
        currentStep++;
        setProgress(currentStep / totalSteps);
      }

      // 2. Seed Recipes
      addLog('\n--- Seeding Recipes ---');
      
      for (let i = 0; i < SEED_RECIPES.length; i++) {
        const recipe = SEED_RECIPES[i];
        try {
          addLog(`Adding recipe: ${recipe.title}...`);
          
          // Find the author details
          const author = SEED_USERS.find(u => u.id === recipe.seedAuthorId);
          const authorId = author ? author.id : effectiveUserId;
          const authorName = author ? author.displayName : effectiveUserName;

          // Calculate calories for each ingredient
          // Note: SEED_RECIPES usually have Ingredients (from types/index.ts) but we need to ensure they have 'calories'
          // calculated if they are missing. The seed data 'ingredients' property matches RecipeFormData['ingredients'] 
          // which is Omit<Ingredient, 'calories'>. So we must add it.
          const ingredientsWithCalories = recipe.ingredients.map((ing) => ({
            ...ing,
            calories: calculateIngredientCalories(ing.name, ing.amount, ing.unit),
          }));

          // Calculate nutrition info
          const nutrition = calculateNutrition(ingredientsWithCalories, recipe.servings);

          // Prepare recipe data
          const recipeData = {
            id: recipe.id, // Use FIXED ID
            title: recipe.title,
            description: recipe.description,
            imageURL: recipe.imageURL,
            ingredients: ingredientsWithCalories,
            instructions: recipe.instructions,
            servings: recipe.servings,
            prepTime: recipe.prepTime,
            cookTime: recipe.cookTime,
            difficulty: recipe.difficulty,
            cuisine: recipe.cuisine,
            category: recipe.category,
            tags: recipe.tags,
            authorId: authorId,
            authorName: authorName,
            isOfficial: true,
            likes: 0,
            rating: 0,
            reviewCount: 0,
            nutrition: nutrition, // Use calculated nutrition
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };

          // Use setDoc to create/update with FIXED ID
          await setDoc(doc(db, COLLECTIONS.RECIPES, recipe.id), recipeData);
          
          recipeIdMap[i] = recipe.id;
          recipeCount++;
          addLog(`✅ Added/Updated recipe: ${recipe.title}`);
        } catch (error) {
          console.error(error);
          addLog(`❌ Failed recipe: ${recipe.title}`);
        }
        currentStep++;
        setProgress(currentStep / totalSteps);
      }

      // 3. Seed Cookbooks
      addLog('\n--- Seeding Cookbooks ---');

      for (const cookbook of SEED_COOKBOOKS) {
        try {
          addLog(`Creating cookbook: ${cookbook.title}...`);
          
          // Resolve recipe indices to real IDs
          const realRecipeIds = cookbook.seedRecipeIndices
            .map(index => recipeIdMap[index])
            .filter(id => !!id); // Filter out undefined if a recipe failed
            
          const author = SEED_USERS.find(u => u.id === cookbook.seedAuthorId);
          
          // Create/Update cookbook document with FIXED ID
          await setDoc(doc(db, COLLECTIONS.COOKBOOKS, cookbook.id), {
            id: cookbook.id,
            title: cookbook.title,
            description: cookbook.description,
            coverImageURL: cookbook.coverImageURL,
            recipeIds: realRecipeIds,
            category: cookbook.category,
            authorId: cookbook.seedAuthorId, // We can store author ID if we update the type later
            authorName: author?.displayName || 'SousChef Team',
            likes: 0,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });

          cookbookCount++;
          addLog(`✅ Created/Updated cookbook: ${cookbook.title} (${realRecipeIds.length} recipes)`);
        } catch (error) {
          console.error(error);
          addLog(`❌ Failed cookbook: ${cookbook.title}`);
        }
        currentStep++;
        setProgress(currentStep / totalSteps);
      }
      
      addLog(`\n🎉 DONE! Users: ${userCount}, Recipes: ${recipeCount}, Cookbooks: ${cookbookCount}`);
      Alert.alert('Seeding Complete', `Added ${recipeCount} recipes and ${cookbookCount} cookbooks.`);
      
    } catch (error) {
      console.error('Seeding error:', error);
      Alert.alert('Seeding Failed', 'An unexpected error occurred.');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen 
        options={{ 
          title: 'Full Database Seed',
          headerBackTitle: 'Profile'
        }} 
      />
      
      <View className="p-6 flex-1">
        <View className="mb-6 items-center">
          <View className="w-20 h-20 bg-primary-100 rounded-full items-center justify-center mb-4">
            <Ionicons name="server-outline" size={40} color="#F97316" />
          </View>
          <Text className="text-2xl font-bold text-neutral-900 text-center">
            Master Data Seeder
          </Text>
          <Text className="text-neutral-500 text-center mt-2 px-4">
            Populate Users, Chefs, Recipes, and linked Cookbooks.
          </Text>
        </View>

        <View className="bg-neutral-50 rounded-xl p-4 flex-1 mb-6 border border-neutral-200">
          <Text className="font-semibold text-neutral-700 mb-2">Process Logs:</Text>
          <ScrollView className="flex-1" ref={ref => ref?.scrollToEnd({ animated: true })}>
            {logs.length === 0 ? (
              <Text className="text-neutral-400 italic">Ready to initialize database...</Text>
            ) : (
              logs.map((log, index) => (
                <Text key={index} className="text-neutral-600 text-xs mb-1 font-mono">
                  {log}
                </Text>
              ))
            )}
          </ScrollView>
        </View>

        {isSeeding && (
          <View className="mb-6">
            <View className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <View 
                className="h-full bg-primary-500 rounded-full" 
                style={{ width: `${progress * 100}%` }} 
              />
            </View>
            <Text className="text-right text-xs text-neutral-400 mt-1">
              {Math.round(progress * 100)}%
            </Text>
          </View>
        )}

        <Button 
          title={isSeeding ? "Seeding Data..." : "Start Full Seed"} 
          onPress={handleSeed}
          isLoading={isSeeding}
          disabled={isSeeding}
        />
      </View>
    </SafeAreaView>
  );
}
