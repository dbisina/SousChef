import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/authStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { uploadImage } from '@/lib/cloudinary';
import { showSuccessToast, showErrorToast, showInfoToast, showWarningToast } from '@/stores/toastStore';
import { FIXED } from '@/stores/themeStore';
import { RecipeCategory, Cuisine, Difficulty } from '@/types';
import {
  Chip,
  ChipRow,
  Field,
  FONT,
  H2,
  Icon,
  Rows,
  Screen,
  SectionLabel,
  Segmented,
  Tag,
  ToneBlock,
  TopBar,
  UButton,
  UIconButton,
  UInput,
} from '@/components/ui';
import { youtubeUrlPattern, ActionBar } from '@/components/recipe';

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
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1, 'Ingredient name is required'),
        amount: z.number().min(0),
        unit: z.string(),
        optional: z.boolean(),
      })
    )
    .min(1, 'At least one ingredient is required'),
  instructions: z.array(z.string().min(1)).min(1, 'At least one instruction is required'),
  tags: z.array(z.string()),
});

type RecipeFormData = z.infer<typeof recipeSchema>;

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

export default function UploadScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
    setValue('tags', tags.filter((x) => x !== tag));
  };

  const onSubmit = async (data: RecipeFormData) => {
    if (!imageUri) {
      showInfoToast("Don't forget to add a photo! We'd love to see your creation. 🖼️", 'Photo Needed');
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
      showErrorToast("Oops! We hit a snag uploading your recipe. Let's try once more? 🔄", 'Upload Problem');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cell = {
    fontFamily: FONT.sans,
    fontSize: 15,
    height: 44,
    paddingHorizontal: 0,
  } as const;

  return (
    <Screen
      scroll
      bottomSpace={150}
      footer={
        <ActionBar>
          <UButton
            label={t('cooking.uploadRecipe', 'Upload Recipe')}
            variant="accent"
            loading={isSubmitting}
            onPress={handleSubmit(onSubmit)}
            style={{ flex: 1 }}
          />
        </ActionBar>
      }
    >
      <TopBar
        variant="compact"
        title={t('cooking.newRecipe', 'New Recipe')}
        left={
          <UIconButton
            icon="close"
            label={t('cooking.close', 'Close')}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          />
        }
      />

      {/* Cover photo */}
      <ToneBlock
        tone="dark"
        className="bg-surface-3 overflow-hidden"
        style={{ height: 180, borderRadius: 30 }}
      >
        {imageUri ? <Image source={{ uri: imageUri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : null}
        <View style={{ position: 'absolute', top: 14, left: 14 }}>
          <Tag large tone="glassDark" label={t('cooking.coverPhoto', 'Cover photo')} />
        </View>
        {!imageUri ? (
          <View className="flex-1 items-center justify-center" style={{ gap: 6 }}>
            <Icon name="image" size="lg" color="muted" />
            <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 13 }}>
              {t('cooking.addPhotoHint', 'Add a photo of your dish')}
            </Text>
          </View>
        ) : null}
        <View className="flex-row" style={{ position: 'absolute', right: 14, bottom: 14, gap: 8 }}>
          <UIconButton icon="image" label={t('cooking.chooseGallery', 'Choose from gallery')} tone="glass" onPress={pickImage} />
          <UIconButton icon="camera" label={t('cooking.takePhotoShort', 'Take photo')} tone="glass" onPress={takePhoto} />
        </View>
      </ToneBlock>

      <Controller
        control={control}
        name="title"
        render={({ field: { onChange, value } }) => (
          <Field
            label={t('cooking.recipeTitle', 'Recipe Title')}
            placeholder={t('cooking.titlePlaceholder', "e.g., Grandma's Sunday roast")}
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
          <Field
            label={t('cooking.description', 'Description')}
            placeholder={t('cooking.descriptionPlaceholder', 'Describe your recipe...')}
            value={value}
            onChangeText={onChange}
            multiline
            error={errors.description?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="youtubeURL"
        render={({ field: { onChange, value } }) => (
          <Field
            label={t('cooking.youtubeOptional', 'YouTube Video (optional)')}
            placeholder="https://youtube.com/watch?v=..."
            value={value}
            onChangeText={onChange}
            autoCapitalize="none"
            keyboardType="url"
            error={errors.youtubeURL?.message}
          />
        )}
      />

      {/* Category / cuisine / difficulty */}
      <View style={{ gap: 8 }}>
        <SectionLabel>{t('cooking.category', 'Category')}</SectionLabel>
        <View style={{ marginHorizontal: -20 }}>
          <Controller
            control={control}
            name="category"
            render={({ field: { onChange, value } }) => (
              <ChipRow>
                {CATEGORIES.map((o) => (
                  <Chip key={o.value} label={o.label} on={value === o.value} onPress={() => onChange(o.value)} />
                ))}
              </ChipRow>
            )}
          />
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <SectionLabel>{t('cooking.cuisine', 'Cuisine')}</SectionLabel>
        <View style={{ marginHorizontal: -20 }}>
          <Controller
            control={control}
            name="cuisine"
            render={({ field: { onChange, value } }) => (
              <ChipRow>
                {CUISINES.map((o) => (
                  <Chip key={o.value} label={o.label} on={value === o.value} onPress={() => onChange(o.value)} />
                ))}
              </ChipRow>
            )}
          />
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <SectionLabel>{t('cooking.difficulty', 'Difficulty')}</SectionLabel>
        <Controller
          control={control}
          name="difficulty"
          render={({ field: { onChange, value } }) => (
            <Segmented<Difficulty>
              value={value}
              onChange={onChange}
              options={[
                { value: 'easy', label: t('cooking.easy', 'Easy') },
                { value: 'medium', label: t('cooking.medium', 'Medium') },
                { value: 'hard', label: t('cooking.hard', 'Hard') },
              ]}
            />
          )}
        />
      </View>

      {/* Time and servings */}
      <View className="flex-row" style={{ gap: 10 }}>
        <Controller
          control={control}
          name="prepTime"
          render={({ field: { onChange, value } }) => (
            <View className="flex-1">
              <Field
                label={t('cooking.prepMin', 'Prep (min)')}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder="10"
                value={value.toString()}
                onChangeText={(v) => onChange(parseInt(v, 10) || 0)}
                error={errors.prepTime?.message}
              />
            </View>
          )}
        />
        <Controller
          control={control}
          name="cookTime"
          render={({ field: { onChange, value } }) => (
            <View className="flex-1">
              <Field
                label={t('cooking.cookMin', 'Cook (min)')}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder="20"
                value={value.toString()}
                onChangeText={(v) => onChange(parseInt(v, 10) || 0)}
              />
            </View>
          )}
        />
        <Controller
          control={control}
          name="servings"
          render={({ field: { onChange, value } }) => (
            <View className="flex-1">
              <Field
                label={t('cooking.servings', 'Servings')}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder="4"
                value={value.toString()}
                onChangeText={(v) => onChange(parseInt(v, 10) || 1)}
                error={errors.servings?.message}
              />
            </View>
          )}
        />
      </View>

      {/* Ingredients */}
      <View className="flex-row items-center justify-between">
        <H2>{t('cooking.ingredients', 'Ingredients')}</H2>
        <Pressable
          onPress={() => appendIngredient({ name: '', amount: 1, unit: 'cup', optional: false })}
          accessibilityRole="button"
          accessibilityLabel={t('cooking.addIngredient', 'Add ingredient')}
          className="flex-row items-center"
          style={{ height: 44, gap: 4 }}
        >
          <Icon name="plus" size="sm" />
          <Text className="text-ink" style={{ fontFamily: FONT.sansMedium, fontSize: 13 }}>
            {t('cooking.add', 'Add')}
          </Text>
        </Pressable>
      </View>
      {errors.ingredients ? (
        <Text className="text-tag-r-fg" style={{ fontFamily: FONT.sans, fontSize: 12, marginTop: -10 }}>
          {errors.ingredients.message || t('cooking.fixIngredients', 'Please fix ingredient errors below')}
        </Text>
      ) : null}
      <Rows box>
        {ingredientFields.map((field, index) => (
          <View key={field.id} className="flex-row items-center" style={{ minHeight: 64, gap: 10 }}>
            <Controller
              control={control}
              name={`ingredients.${index}.amount`}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  accessibilityLabel={t('cooking.amount', 'Amount')}
                  className="text-ink"
                  style={[cell, { width: 40, fontFamily: FONT.sansSemi }]}
                  keyboardType="decimal-pad"
                  value={value.toString()}
                  onChangeText={(v) => onChange(parseFloat(v) || 0)}
                />
              )}
            />
            <Controller
              control={control}
              name={`ingredients.${index}.unit`}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  accessibilityLabel={t('cooking.unit', 'Unit')}
                  className="text-ink"
                  style={[cell, { width: 54, fontFamily: FONT.sansSemi }]}
                  value={value}
                  onChangeText={onChange}
                  placeholder={t('cooking.unit', 'Unit')}
                  placeholderTextColor={FIXED.placeholder}
                />
              )}
            />
            <Controller
              control={control}
              name={`ingredients.${index}.name`}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  accessibilityLabel={t('cooking.ingredientName', 'Ingredient name')}
                  className={errors.ingredients?.[index]?.name ? 'flex-1 text-tag-r-fg' : 'flex-1 text-ink'}
                  style={cell}
                  value={value}
                  onChangeText={onChange}
                  placeholder={t('cooking.ingredientName', 'Ingredient name')}
                  placeholderTextColor={FIXED.placeholder}
                />
              )}
            />
            <UIconButton
              icon="close"
              label={t('cooking.removeIngredient', 'Remove ingredient')}
              tone="white"
              size={34}
              iconSize="sm"
              onPress={() => removeIngredient(index)}
            />
          </View>
        ))}
      </Rows>

      {/* Instructions */}
      <H2>{t('cooking.instructions', 'Instructions')}</H2>
      {errors.instructions ? (
        <Text className="text-tag-r-fg" style={{ fontFamily: FONT.sans, fontSize: 12, marginTop: -10 }}>
          {errors.instructions.message || t('cooking.needInstruction', 'At least one instruction is required')}
        </Text>
      ) : null}
      {instructions.length > 0 ? (
        <Rows box>
          {instructions.map((instruction, index) => (
            <View key={index} className="flex-row items-center" style={{ minHeight: 64, gap: 12, paddingVertical: 8 }}>
              <View className="items-center justify-center bg-surface-3" style={{ width: 32, height: 32, borderRadius: 16 }}>
                <Text className="text-muted" style={{ fontFamily: FONT.display, fontSize: 13 }}>
                  {index + 1}
                </Text>
              </View>
              <Text className="flex-1 text-ink" style={{ fontFamily: FONT.sans, fontSize: 14, lineHeight: 20 }}>
                {instruction}
              </Text>
              <UIconButton
                icon="close"
                label={t('cooking.removeStep', 'Remove step')}
                tone="white"
                size={34}
                iconSize="sm"
                onPress={() => removeInstruction(index)}
              />
            </View>
          ))}
        </Rows>
      ) : null}
      <UInput
        label={t('cooking.addStep', 'Add a step...')}
        placeholder={t('cooking.addStep', 'Add a step...')}
        value={newInstruction}
        onChangeText={setNewInstruction}
        onSubmitEditing={addInstruction}
        returnKeyType="done"
        right={
          <UIconButton
            icon="plus"
            label={t('cooking.addStepButton', 'Add step')}
            tone="accent"
            size={44}
            onPress={addInstruction}
          />
        }
      />

      {/* Tags */}
      <H2>{t('cooking.tags', 'Tags')}</H2>
      {tags.length > 0 ? (
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {tags.map((tag) => (
            <Pressable
              key={tag}
              onPress={() => removeTag(tag)}
              accessibilityRole="button"
              accessibilityLabel={t('cooking.removeTag', 'Remove tag {{tag}}', { tag })}
              className="flex-row items-center bg-tag-o"
              style={{ height: 36, borderRadius: 18, paddingHorizontal: 14, gap: 6 }}
            >
              <Text className="text-tag-o-fg" style={{ fontFamily: FONT.sansMedium, fontSize: 13 }}>
                {tag}
              </Text>
              <Icon name="close" size="sm" color="tag-o-fg" />
            </Pressable>
          ))}
        </View>
      ) : null}
      <UInput
        label={t('cooking.addTag', 'Add a tag...')}
        placeholder={t('cooking.addTag', 'Add a tag...')}
        value={newTag}
        onChangeText={setNewTag}
        onSubmitEditing={addTag}
        returnKeyType="done"
        right={
          <UIconButton
            icon="plus"
            label={t('cooking.addTagButton', 'Add tag')}
            tone="accent"
            size={44}
            onPress={addTag}
          />
        }
      />
    </Screen>
  );
}
