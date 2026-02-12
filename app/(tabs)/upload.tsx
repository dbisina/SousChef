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
import { showSuccessToast, showErrorToast, showInfoToast, showWarningToast } from '@/stores/toastStore';
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

export default function UploadScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { createRecipe } = useRecipeStore();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newInstruction, setNewInstruction] = useState('');
  const [newTag, setNewTag] = useState('');

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

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showWarningToast('We need camera access to take a photo of your masterpiece! 📸', 'Permission Needed');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
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
      showInfoToast('Don\'t forget to add a photo! We\'d love to see your creation. 🖼️', 'Photo Needed');
      return;
    }

    if (!user) {
      showWarningToast('Please sign in so we can save your recipe to your cookbook! 🧑‍🍳', 'Sign In Needed');
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload image to Cloudinary
      const uploadedImageUrl = await uploadImage(imageUri, `souschef/recipes/${user.id}`);

      // Create recipe
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
        user.role === 'chef' || user.role === 'admin'
      );

      showSuccessToast('Wonderful! Your recipe is now in your cookbook. ✨', 'Great Work!');
      router.push('/(tabs)');
    } catch (error) {
      showErrorToast('Oops! We hit a snag uploading your recipe. Let\'s try once more? 🔄', 'Upload Problem');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-4">
          {/* Header */}
          <Text className="text-2xl font-bold text-neutral-900 mb-6">
            Add New Recipe
          </Text>

          {/* Image picker */}
          <Text className="text-sm font-medium text-neutral-700 mb-2">
            Recipe Photo
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
            <View className="flex-row space-x-3 mb-4">
              <TouchableOpacity
                onPress={pickImage}
                className="flex-1 bg-white rounded-xl p-6 items-center border-2 border-dashed border-neutral-200"
              >
                <Ionicons name="images-outline" size={32} color="#737373" />
                <Text className="text-neutral-500 mt-2">Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={takePhoto}
                className="flex-1 bg-white rounded-xl p-6 items-center border-2 border-dashed border-neutral-200"
              >
                <Ionicons name="camera-outline" size={32} color="#737373" />
                <Text className="text-neutral-500 mt-2">Camera</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Basic info */}
          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Recipe Title"
                placeholder="e.g., Grandma's Chicken Soup"
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
                label="Description"
                placeholder="Describe your recipe..."
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

          {/* Selectors */}
          <View className="flex-row space-x-3 mb-4">
            <View className="flex-1">
              <Text className="text-sm font-medium text-neutral-700 mb-2">Category</Text>
              <Controller
                control={control}
                name="category"
                render={({ field: { onChange, value } }) => (
                  <Selector
                    options={CATEGORIES}
                    value={value}
                    onChange={onChange}
                  />
                )}
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-neutral-700 mb-2">Cuisine</Text>
              <Controller
                control={control}
                name="cuisine"
                render={({ field: { onChange, value } }) => (
                  <Selector
                    options={CUISINES}
                    value={value}
                    onChange={onChange}
                  />
                )}
              />
            </View>
          </View>

          <View className="flex-row space-x-3 mb-4">
            <View className="flex-1">
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
                        className={`flex-1 py-2 items-center rounded-lg ${
                          value === d ? 'bg-primary-500' : 'bg-white'
                        }`}
                      >
                        <Text className={value === d ? 'text-white' : 'text-neutral-700'}>
                          {d.charAt(0).toUpperCase() + d.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              />
            </View>
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
            Ingredients
          </Text>
          {ingredientFields.map((field, index) => (
            <View key={field.id} className="flex-row items-center mb-2">
              <View className="flex-1 flex-row space-x-2">
                <Controller
                  control={control}
                  name={`ingredients.${index}.amount`}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="w-16 bg-white rounded-lg px-3 py-2 text-center"
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
                      className="w-16 bg-white rounded-lg px-3 py-2 text-center"
                      value={value}
                      onChangeText={onChange}
                      placeholder="unit"
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`ingredients.${index}.name`}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="flex-1 bg-white rounded-lg px-3 py-2"
                      value={value}
                      onChangeText={onChange}
                      placeholder="Ingredient name"
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
            Instructions
          </Text>
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
              placeholder="Add a step..."
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
                <Ionicons name="close" size={16} color="#FF6B35" className="ml-1" />
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

          {/* Submit button */}
          <View className="mt-8 mb-4">
            <Button
              title="Upload Recipe"
              onPress={handleSubmit(onSubmit)}
              isLoading={isSubmitting}
              fullWidth
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface SelectorProps {
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}

const Selector: React.FC<SelectorProps> = ({ options, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View>
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        className="bg-white rounded-lg px-4 py-3 flex-row items-center justify-between"
      >
        <Text className="text-neutral-700">{selected?.label || 'Select'}</Text>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#737373" />
      </TouchableOpacity>
      {isOpen && (
        <View className="absolute top-12 left-0 right-0 bg-white rounded-lg shadow-lg z-10 max-h-48">
          <ScrollView>
            {options.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="px-4 py-3 border-b border-neutral-100"
              >
                <Text
                  className={option.value === value ? 'text-primary-500 font-medium' : 'text-neutral-700'}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const CATEGORIES = [
  { label: 'Breakfast', value: 'breakfast' },
  { label: 'Lunch', value: 'lunch' },
  { label: 'Dinner', value: 'dinner' },
  { label: 'Dessert', value: 'dessert' },
  { label: 'Snack', value: 'snack' },
  { label: 'Appetizer', value: 'appetizer' },
  { label: 'Beverage', value: 'beverage' },
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
  { label: 'Other', value: 'other' },
];
