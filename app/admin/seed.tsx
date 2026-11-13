import React, { useState } from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useRecipeStore } from '@/stores/recipeStore';
import { useAuthStore } from '@/stores/authStore';
import { SAMPLE } from '@/assets/sample';
import { CtaBar, Muted, PhotoCard, ProgressBar, Screen, SectionLabel, TopBar, UButton } from '@/components/ui';
import { SEED_RECIPES, SEED_USERS, SEED_COOKBOOKS } from '@/data/seedData';
import { db, auth, doc, setDoc, collection, Timestamp, createUserWithEmailAndPassword, updateProfile } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/firebase';
import { seedDemoAd } from '@/services/adService';
import { calculateNutrition, calculateIngredientCalories } from '@/lib/utils';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export default function SeedDataScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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

              addLog(`  - OK: Auth account created (UID: ${finalUserId})`);
            } catch (authError: any) {
              if (authError.code === 'auth/email-already-in-use') {
                addLog(`  - Note: Auth account already exists, using seed ID`);
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
              const pantryRef = collection(db, COLLECTIONS.USERS, finalUserId, 'pantry');
              
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
          addLog(`OK: Created/Updated user: ${seedUser.displayName}`);
        } catch (error) {
          console.error(error);
          addLog(`Failed: Failed user: ${seedUser.displayName} - ${error instanceof Error ? error.message : String(error)}`);
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
          addLog(`OK: Added/Updated recipe: ${recipe.title}`);
        } catch (error) {
          console.error(error);
          addLog(`Failed: Failed recipe: ${recipe.title}`);
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
          addLog(`OK: Created/Updated cookbook: ${cookbook.title} (${realRecipeIds.length} recipes)`);
        } catch (error) {
          console.error(error);
          addLog(`Failed: Failed cookbook: ${cookbook.title}`);
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
    <Screen
      tone="dark"
      bare
      footer={
        <CtaBar vertical>
          <UButton
            variant="accent"
            label={isSeeding ? t('account.seed.seeding', 'Seeding Data...') : t('account.seed.run', 'Run Full Seed')}
            loading={isSeeding}
            disabled={isSeeding}
            onPress={handleSeed}
          />
          <UButton
            variant="ghost"
            label={t('account.seed.demoAd', 'Seed Demo Ad')}
            onPress={async () => {
              try {
                const adId = await seedDemoAd();
                Alert.alert(
                  t('account.seed.adCreated', 'Ad Created'),
                  t('account.seed.adCreatedBody', 'Demo sponsored ad seeded to Firestore.\nDoc ID: {{id}}', { id: adId })
                );
              } catch (e: unknown) {
                Alert.alert(
                  t('account.error', 'Error'),
                  e instanceof Error && e.message ? e.message : t('account.seed.adFailed', 'Failed to seed ad.')
                );
              }
            }}
          />
        </CtaBar>
      }
    >
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar variant="compact" title={t('account.seed.title', 'Database Seed')} onBack={() => router.back()} />
      <View className="flex-1" style={{ paddingHorizontal: 20, paddingBottom: 190, gap: 16 }}>
        <PhotoCard
          source={SAMPLE.veg}
          height={180}
          title={t('account.seed.hero', 'Master Data Seeder')}
          subtitle={t('account.seed.heroBody', 'Users, chefs, recipes and linked cookbooks')}
        />

        <SectionLabel>{t('account.seed.log', 'Process log')}</SectionLabel>
        <View className="bg-surface flex-1" style={{ borderRadius: 28, padding: 18, minHeight: 160 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            ref={(ref) => ref?.scrollToEnd({ animated: true })}
          >
            {logs.length === 0 ? (
              <>
                <Text className="text-ink" style={{ fontFamily: MONO, fontSize: 12 }}>
                  {'> '}
                  {t('account.seed.ready', 'Ready to initialize database...')}
                </Text>
                <Text className="text-subtle" style={{ fontFamily: MONO, fontSize: 12 }}>
                  {'> '}
                  {t('account.seed.waiting', 'waiting for command')}
                </Text>
              </>
            ) : (
              logs.map((log, index) => (
                <Text key={index} className="text-ink" style={{ fontFamily: MONO, fontSize: 12, marginBottom: 4 }}>
                  {log}
                </Text>
              ))
            )}
          </ScrollView>
        </View>

        {isSeeding ? (
          <View style={{ gap: 6 }}>
            <ProgressBar value={progress} variant="accent" label={t('account.seed.progress', 'Seed progress')} />
            <Muted small>{Math.round(progress * 100)}%</Muted>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
