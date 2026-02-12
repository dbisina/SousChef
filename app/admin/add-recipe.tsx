import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/authStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { uploadImage } from '@/lib/cloudinary';
import { RecipeCategory, Cuisine, Difficulty } from '@/types';
import { Button, Input, Card } from '@/components/ui';
import { youtubeUrlPattern } from '@/components/recipe';

const recipeSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  youtubeURL: z.string().regex(youtubeUrlPattern, 'Invalid YouTube URL').optional().or(z.literal('')),
  category: z.string(),
  cuisine: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  prepTime: z.number().min(1, 'Prep time is required'),
  cookTime: z.number().min(0),
  servings: z.number().min(1, 'At least 1 serving'),
  ingredients: z.array(
    z.object({
      name: z.string().min(1, 'Ingredient name is required'),
      amount: z.number().min(0),
      unit: z.string(),
      optional: z.boolean(),
    })
  ).min(1, 'At least one ingredient is required'),
  instructions: z.array(z.string().min(1)).min(1, 'At least one instruction is required'),
  tags: z.array(z.string()),
});

type RecipeFormData = z.infer<typeof recipeSchema>;

export default function AdminAddRecipeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { createRecipe } = useRecipeStore();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newInstruction, setNewInstruction] = useState('');
  const [newTag, setNewTag] = useState('');

  // Check if user has admin/chef permissions
  if (!user || (user.role !== 'admin' && user.role !== 'chef')) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-4">
        <Ionicons name="lock-closed" size={64} color="#EF4444" />
        <Text className="text-xl font-semibold text-neutral-900 mt-4">
          Access Denied
        </Text>
        <Text className="text-neutral-500 text-center mt-2">
          Only chefs and admins can add official recipes.
        </Text>
        <Button
          title="Go Back"
          onPress={() => router.back()}
          className="mt-6"
        />
      </SafeAreaView>
    );
  }

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RecipeFormData>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      title: '',
      description: '',
      youtubeURL: '',
      category: 'dinner',
      cuisine: 'american',
      difficulty: 'medium',
      prepTime: 15,
      cookTime: 30,
      servings: 4,
      ingredients: [{ name: '', amount: 1, unit: 'cup', optional: false }],
      instructions: [],
      tags: [],
    },
  });

  const { fields: ingredientFields, append: appendIngredient, remove: removeIngredient } = useFieldArray({
    control,
    name: 'ingredients',
  });

  const instructions = watch('instructions');
  const tags = watch('tags');

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const addInstruction = () => {
    if (newInstruction.trim()) {
      setValue('instructions', [...instructions, newInstruction.trim()]);
      setNewInstruction('');
    }
  };

  const removeInstruction = (index: number) => {
    setValue('instructions', instructions.filter((_, i) => i !== index));
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setValue('tags', [...tags, newTag.trim().toLowerCase()]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setValue('tags', tags.filter((t) => t !== tag));
  };

  const onSubmit = async (data: RecipeFormData) => {
    if (!imageUri) {
      Alert.alert('Image required', 'Please add a photo of your recipe');
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload image to Cloudinary
      const uploadedImageUrl = await uploadImage(imageUri, 'souschef/recipes/official');

      await createRecipe(
        {
          ...data,
          youtubeURL: data.youtubeURL || undefined,
          category: data.category as RecipeCategory,
          cuisine: data.cuisine as Cuisine,
        },
        uploadedImageUrl,
        user.id,
        user.displayName,
        true // isOfficial = true for admin uploads
      );

      Alert.alert('Success', 'Official recipe created successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to create recipe. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-neutral-100">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#404040" />
        </TouchableOpacity>
        <View className="flex-row items-center">
          <View className="w-6 h-6 rounded-full bg-primary-500 items-center justify-center mr-2">
            <Ionicons name="checkmark" size={16} color="white" />
          </View>
          <Text className="text-lg font-bold text-neutral-900">
            Add Official Recipe
          </Text>
        </View>
        <View className="w-7" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-4">
          {/* Official badge notice */}
          <Card className="bg-primary-50 border border-primary-200 mb-4">
            <View className="flex-row items-center">
              <Ionicons name="ribbon" size={24} color="#FF6B35" />
              <View className="ml-3 flex-1">
                <Text className="font-semibold text-primary-700">
                  Official Recipe
                </Text>
                <Text className="text-sm text-primary-600">
                  This recipe will be marked as a Chef's Pick
                </Text>
              </View>
            </View>
          </Card>

          {/* Image picker */}
          <Text className="text-sm font-medium text-neutral-700 mb-2">
            Recipe Photo *
          </Text>
          {imageUri ? (
            <TouchableOpacity onPress={pickImage} className="mb-4">
              <Image
                source={{ uri: imageUri }}
                className="w-full h-48 rounded-xl"
                resizeMode="cover"
              />
              <View className="absolute bottom-2 right-2 bg-black/50 px-3 py-1 rounded-full">
                <Text className="text-white text-sm">Change</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={pickImage}
              className="bg-white rounded-xl p-8 items-center border-2 border-dashed border-neutral-200 mb-4"
            >
              <Ionicons name="image-outline" size={40} color="#737373" />
              <Text className="text-neutral-500 mt-2">Add Recipe Photo</Text>
            </TouchableOpacity>
          )}

          {/* Form fields - same as upload screen */}
          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Recipe Title *"
                placeholder="e.g., Classic Beef Bourguignon"
                value={value}
                onChangeText={onChange}
                error={errors.title?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Description *"
                placeholder="A rich French beef stew..."
                value={value}
                onChangeText={onChange}
                multiline
                numberOfLines={3}
                error={errors.description?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="youtubeURL"
            render={({ field: { onChange, value } }) => (
              <Input
                label="YouTube Video (optional)"
                placeholder="https://youtube.com/watch?v=..."
                value={value}
                onChangeText={onChange}
                autoCapitalize="none"
                keyboardType="url"
                error={errors.youtubeURL?.message}
              />
            )}
          />

          {/* Category and Cuisine */}
          <View className="flex-row space-x-3 mb-4">
            <View className="flex-1">
              <Text className="text-sm font-medium text-neutral-700 mb-2">Category</Text>
              <Controller
                control={control}
                name="category"
                render={({ field: { onChange, value } }) => (
                  <View className="bg-white rounded-lg">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {CATEGORIES.map((cat) => (
                        <TouchableOpacity
                          key={cat.value}
                          onPress={() => onChange(cat.value)}
                          className={`px-3 py-2 mr-2 rounded-lg ${
                            value === cat.value ? 'bg-primary-500' : 'bg-neutral-100'
                          }`}
                        >
                          <Text
                            className={value === cat.value ? 'text-white' : 'text-neutral-700'}
                          >
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              />
            </View>
          </View>

          {/* Cuisine */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-neutral-700 mb-2">Cuisine</Text>
            <Controller
              control={control}
              name="cuisine"
              render={({ field: { onChange, value } }) => (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {CUISINES.map((cuisine) => (
                    <TouchableOpacity
                      key={cuisine.value}
                      onPress={() => onChange(cuisine.value)}
                      className={`px-3 py-2 mr-2 rounded-lg ${
                        value === cuisine.value ? 'bg-primary-500' : 'bg-white'
                      }`}
                    >
                      <Text
                        className={value === cuisine.value ? 'text-white' : 'text-neutral-700'}
                      >
                        {cuisine.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            />
          </View>

          {/* Difficulty */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-neutral-700 mb-2">Difficulty</Text>
            <Controller
              control={control}
              name="difficulty"
              render={({ field: { onChange, value } }) => (
                <View className="flex-row">
                  {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => onChange(d)}
                      className={`flex-1 py-3 items-center rounded-lg mr-2 ${
                        value === d ? 'bg-primary-500' : 'bg-white'
                      }`}
                    >
                      <Text className={value === d ? 'text-white font-medium' : 'text-neutral-700'}>
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
          </View>

          {/* Time and servings */}
          <View className="flex-row space-x-3 mb-4">
            <Controller
              control={control}
              name="prepTime"
              render={({ field: { onChange, value } }) => (
                <View className="flex-1">
                  <Input
                    label="Prep Time (min)"
                    keyboardType="number-pad"
                    value={value.toString()}
                    onChangeText={(t) => onChange(parseInt(t) || 0)}
                  />
                </View>
              )}
            />
            <Controller
              control={control}
              name="cookTime"
              render={({ field: { onChange, value } }) => (
                <View className="flex-1">
                  <Input
                    label="Cook Time (min)"
                    keyboardType="number-pad"
                    value={value.toString()}
                    onChangeText={(t) => onChange(parseInt(t) || 0)}
                  />
                </View>
              )}
            />
            <Controller
              control={control}
              name="servings"
              render={({ field: { onChange, value } }) => (
                <View className="flex-1">
                  <Input
                    label="Servings"
                    keyboardType="number-pad"
                    value={value.toString()}
                    onChangeText={(t) => onChange(parseInt(t) || 1)}
                  />
                </View>
              )}
            />
          </View>

          {/* Ingredients */}
          <Text className="text-lg font-bold text-neutral-900 mt-4 mb-3">
            Ingredients *
          </Text>
          {errors.ingredients && (
            <Text className="text-red-500 text-sm mb-2">
              {errors.ingredients.message || 'Please fix ingredient errors below'}
            </Text>
          )}
          {ingredientFields.map((field, index) => (
            <View key={field.id} className="flex-row items-center mb-2">
              <View className="flex-1 flex-row space-x-2">
                <Controller
                  control={control}
                  name={`ingredients.${index}.amount`}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="w-14 bg-white rounded-lg px-2 py-2 text-center"
                      keyboardType="decimal-pad"
                      value={value.toString()}
                      onChangeText={(t) => onChange(parseFloat(t) || 0)}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`ingredients.${index}.unit`}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="w-14 bg-white rounded-lg px-2 py-2 text-center"
                      value={value}
                      onChangeText={onChange}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`ingredients.${index}.name`}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className={`flex-1 bg-white rounded-lg px-3 py-2 ${
                        errors.ingredients?.[index]?.name ? 'border border-red-400' : ''
                      }`}
                      value={value}
                      onChangeText={onChange}
                      placeholder="Ingredient"
                    />
                  )}
                />
              </View>
              <TouchableOpacity
                onPress={() => removeIngredient(index)}
                className="ml-2 p-2"
              >
                <Ionicons name="close-circle" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            onPress={() => appendIngredient({ name: '', amount: 1, unit: 'cup', optional: false })}
            className="flex-row items-center py-2"
          >
            <Ionicons name="add-circle-outline" size={24} color="#FF6B35" />
            <Text className="text-primary-500 ml-2">Add Ingredient</Text>
          </TouchableOpacity>

          {/* Instructions */}
          <Text className="text-lg font-bold text-neutral-900 mt-4 mb-3">
            Instructions *
          </Text>
          {errors.instructions && (
            <Text className="text-red-500 text-sm mb-2">
              {errors.instructions.message || 'At least one instruction is required'}
            </Text>
          )}
          {instructions.map((instruction, index) => (
            <View key={index} className="flex-row items-start mb-2 bg-white rounded-lg p-3">
              <Text className="w-6 text-primary-500 font-bold">{index + 1}.</Text>
              <Text className="flex-1 text-neutral-700">{instruction}</Text>
              <TouchableOpacity onPress={() => removeInstruction(index)}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
          <View className="flex-row items-center">
            <TextInput
              className="flex-1 bg-white rounded-lg px-4 py-3"
              value={newInstruction}
              onChangeText={setNewInstruction}
              placeholder="Add a cooking step..."
              multiline
            />
            <TouchableOpacity onPress={addInstruction} className="ml-2 p-2">
              <Ionicons name="add-circle" size={28} color="#FF6B35" />
            </TouchableOpacity>
          </View>

          {/* Tags */}
          <Text className="text-lg font-bold text-neutral-900 mt-4 mb-3">
            Tags
          </Text>
          <View className="flex-row flex-wrap mb-2">
            {tags.map((tag) => (
              <TouchableOpacity
                key={tag}
                onPress={() => removeTag(tag)}
                className="bg-primary-100 px-3 py-1 rounded-full mr-2 mb-2 flex-row items-center"
              >
                <Text className="text-primary-700">{tag}</Text>
                <Ionicons name="close" size={16} color="#FF6B35" />
              </TouchableOpacity>
            ))}
          </View>
          <View className="flex-row items-center">
            <TextInput
              className="flex-1 bg-white rounded-lg px-4 py-3"
              value={newTag}
              onChangeText={setNewTag}
              placeholder="Add a tag..."
              onSubmitEditing={addTag}
            />
            <TouchableOpacity onPress={addTag} className="ml-2 p-2">
              <Ionicons name="add-circle" size={28} color="#FF6B35" />
            </TouchableOpacity>
          </View>

          {/* Submit */}
          <View className="mt-8 mb-4">
            <Button
              title="Publish Official Recipe"
              onPress={handleSubmit(onSubmit)}
              isLoading={isSubmitting}
              fullWidth
              leftIcon={<Ionicons name="checkmark-circle" size={20} color="white" />}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const CATEGORIES = [
  { label: 'Breakfast', value: 'breakfast' },
  { label: 'Lunch', value: 'lunch' },
  { label: 'Dinner', value: 'dinner' },
  { label: 'Dessert', value: 'dessert' },
  { label: 'Snack', value: 'snack' },
  { label: 'Appetizer', value: 'appetizer' },
  { label: 'Side', value: 'side' },
];

const CUISINES = [
  { label: 'American', value: 'american' },
  { label: 'Italian', value: 'italian' },
  { label: 'Mexican', value: 'mexican' },
  { label: 'Chinese', value: 'chinese' },
  { label: 'Japanese', value: 'japanese' },
  { label: 'Indian', value: 'indian' },
  { label: 'Thai', value: 'thai' },
  { label: 'French', value: 'french' },
  { label: 'Mediterranean', value: 'mediterranean' },
  { label: 'Korean', value: 'korean' },
  { label: 'Vietnamese', value: 'vietnamese' },
];
