import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { FIXED } from '@/stores/themeStore';
import { uploadImage } from '@/lib/cloudinary';
import { RecipeCategory, Cuisine, Difficulty } from '@/types';
import {
  Chip,
  CtaBar,
  Field,
  FONT,
  H2,
  Icon,
  Muted,
  Screen,
  Tag,
  Title,
  TopBar,
  UButton,
  UIconButton,
  UInput,
  useTokens,
} from '@/components/ui';
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

/** Compact input used inside the ingredient rows. */
function MiniInput({
  value,
  onChangeText,
  placeholder,
  width,
  keyboardType,
  center,
  label,
  invalid,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  width?: number;
  keyboardType?: 'default' | 'decimal-pad';
  center?: boolean;
  label: string;
  invalid?: boolean;
}) {
  const tokens = useTokens();
  return (
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={FIXED.placeholder}
      selectionColor={tokens.accent}
      keyboardType={keyboardType}
      className="bg-raise text-ink"
      style={{
        ...(invalid ? { borderWidth: 1.5, borderColor: tokens['tag-r-fg'] } : null),
        height: 44,
        borderRadius: 14,
        paddingHorizontal: 10,
        fontFamily: FONT.sans,
        fontSize: 14,
        textAlign: center ? 'center' : 'left',
        ...(width ? { width } : { flex: 1 }),
      }}
    />
  );
}

export default function AdminAddRecipeScreen() {
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

  // Check if user has admin/chef permissions
  if (!user || (user.role !== 'admin' && user.role !== 'chef')) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 24, gap: 12 }}>
          <Icon name="lock" size="lg" color="tag-r-fg" />
          <Title>{t('account.add.denied', 'Access Denied')}</Title>
          <Muted center>{t('account.add.deniedBody', 'Only chefs and admins can add official recipes.')}</Muted>
          <UButton size="sm" label={t('account.add.goBack', 'Go Back')} onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

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
    setValue('tags', tags.filter((x) => x !== tag));
  };

  const onSubmit = async (data: RecipeFormData) => {
    if (!imageUri) {
      Alert.alert(t('account.add.imageRequired', 'Image required'), t('account.add.imageRequiredBody', 'Please add a photo of your recipe'));
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

      Alert.alert(t('account.ads.success', 'Success'), t('account.add.created', 'Official recipe created successfully!'), [
        { text: t('account.ok', 'OK'), onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert(t('account.error', 'Error'), t('account.add.createFailed', 'Failed to create recipe. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const label = (text: string) => (
    <Muted small style={{ paddingStart: 4 }}>
      {text}
    </Muted>
  );

  return (
    <Screen
      bare
      footer={
        <CtaBar fade>
          <UButton
            variant="accent"
            label={t('account.add.publish', 'Publish Recipe')}
            loading={isSubmitting}
            onPress={handleSubmit(onSubmit)}
          />
        </CtaBar>
      }
    >
      <TopBar
        variant="compact"
        title={t('account.add.title', 'Official Recipe')}
        left={<UIconButton icon="close" label={t('account.close', 'Close')} onPress={() => router.back()} />}
        right={<Tag tone="k" label={t('account.add.chefsPick', "Chef's Pick")} />}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150, gap: 14 }}
        >
          {/* Image picker */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={imageUri ? t('account.add.changePhoto', 'Change') : t('account.add.addPhoto', 'Add Recipe Photo')}
            onPress={pickImage}
            className="bg-surface-3 items-center justify-center"
            style={{ height: 190, borderRadius: 30, overflow: 'hidden' }}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" accessible={false} />
            ) : (
              <View className="items-center" style={{ gap: 8 }}>
                <Icon name="image" size="lg" color="muted" />
                <Muted>{t('account.add.addPhoto', 'Add Recipe Photo')}</Muted>
              </View>
            )}
            <View style={{ position: 'absolute', top: 14, left: 14 }}>
              <Tag tone="glassDark" large label={t('account.add.photoLabel', 'Recipe photo *')} />
            </View>
            {imageUri ? (
              <View style={{ position: 'absolute', right: 14, bottom: 14 }}>
                <Tag tone="glass" large icon="camera" label={t('account.add.changePhoto', 'Change')} />
              </View>
            ) : null}
          </Pressable>

          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, value } }) => (
              <Field
                label={t('account.add.recipeTitle', 'Recipe Title *')}
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
              <Field
                label={t('account.add.description', 'Description *')}
                placeholder="A rich French beef stew..."
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
                label={t('account.add.youtube', 'YouTube Video (optional)')}
                placeholder="https://youtube.com/watch?v=..."
                value={value}
                onChangeText={onChange}
                autoCapitalize="none"
                keyboardType="url"
                error={errors.youtubeURL?.message}
              />
            )}
          />

          {/* Category */}
          <View style={{ gap: 8 }}>
            {label(t('account.add.category', 'Category'))}
            <Controller
              control={control}
              name="category"
              render={({ field: { onChange, value } }) => (
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {CATEGORIES.map((cat) => (
                    <Chip key={cat.value} label={cat.label} on={value === cat.value} onPress={() => onChange(cat.value)} />
                  ))}
                </View>
              )}
            />
          </View>

          {/* Cuisine */}
          <View style={{ gap: 8 }}>
            {label(t('account.add.cuisine', 'Cuisine'))}
            <Controller
              control={control}
              name="cuisine"
              render={({ field: { onChange, value } }) => (
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {CUISINES.map((c) => (
                    <Chip key={c.value} label={c.label} on={value === c.value} onPress={() => onChange(c.value)} />
                  ))}
                </View>
              )}
            />
          </View>

          {/* Difficulty */}
          <View style={{ gap: 8 }}>
            {label(t('account.add.difficulty', 'Difficulty'))}
            <Controller
              control={control}
              name="difficulty"
              render={({ field: { onChange, value } }) => (
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                    <Chip key={d} label={d.charAt(0).toUpperCase() + d.slice(1)} on={value === d} onPress={() => onChange(d)} />
                  ))}
                </View>
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
                    label={t('account.add.prep', 'Prep (min)')}
                    keyboardType="number-pad"
                    value={value.toString()}
                    onChangeText={(v) => onChange(parseInt(v) || 0)}
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
                    label={t('account.add.cook', 'Cook (min)')}
                    keyboardType="number-pad"
                    value={value.toString()}
                    onChangeText={(v) => onChange(parseInt(v) || 0)}
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
                    label={t('account.add.servings', 'Servings')}
                    keyboardType="number-pad"
                    value={value.toString()}
                    onChangeText={(v) => onChange(parseInt(v) || 1)}
                  />
                </View>
              )}
            />
          </View>

          {/* Ingredients */}
          <View className="flex-row items-center justify-between">
            <H2>{t('account.add.ingredients', 'Ingredients *')}</H2>
            <Pressable
              accessibilityRole="button"
              onPress={() => appendIngredient({ name: '', amount: 1, unit: 'cup', optional: false })}
              className="flex-row items-center"
              style={{ gap: 4, height: 44 }}
            >
              <Icon name="plus" size="sm" />
              <Text className="text-ink" style={{ fontFamily: FONT.sansMedium, fontSize: 13 }}>
                {t('account.add.addIngredient', 'Add')}
              </Text>
            </Pressable>
          </View>
          {errors.ingredients ? (
            <Text className="text-tag-r-fg" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
              {errors.ingredients.message || t('account.add.fixIngredients', 'Please fix ingredient errors below')}
            </Text>
          ) : null}
          <View className="bg-surface" style={{ borderRadius: 26, paddingHorizontal: 12, paddingVertical: 4 }}>
            {ingredientFields.map((field, index) => (
              <View
                key={field.id}
                className={`flex-row items-center ${index > 0 ? 'border-t border-divider' : ''}`}
                style={{ minHeight: 60, gap: 8 }}
              >
                <Controller
                  control={control}
                  name={`ingredients.${index}.amount`}
                  render={({ field: { onChange, value } }) => (
                    <MiniInput
                      label={t('account.add.amount', 'Amount')}
                      width={56}
                      center
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
                    <MiniInput label={t('account.add.unit', 'Unit')} width={56} center value={value} onChangeText={onChange} />
                  )}
                />
                <Controller
                  control={control}
                  name={`ingredients.${index}.name`}
                  render={({ field: { onChange, value } }) => (
                    <MiniInput
                      label={t('account.add.ingredient', 'Ingredient')}
                      value={value}
                      onChangeText={onChange}
                      placeholder={t('account.add.ingredient', 'Ingredient')}
                      invalid={!!errors.ingredients?.[index]?.name}
                    />
                  )}
                />
                <UIconButton
                  icon="close"
                  tone="white"
                  size={34}
                  label={t('account.add.removeIngredient', 'Remove ingredient')}
                  onPress={() => removeIngredient(index)}
                />
              </View>
            ))}
          </View>

          {/* Instructions */}
          <H2>{t('account.add.instructions', 'Instructions *')}</H2>
          {errors.instructions ? (
            <Text className="text-tag-r-fg" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
              {errors.instructions.message || t('account.add.needInstruction', 'At least one instruction is required')}
            </Text>
          ) : null}
          {instructions.length > 0 ? (
            <View className="bg-surface" style={{ borderRadius: 26, paddingHorizontal: 16, paddingVertical: 4 }}>
              {instructions.map((instruction, index) => (
                <View
                  key={index}
                  className={`flex-row items-start ${index > 0 ? 'border-t border-divider' : ''}`}
                  style={{ paddingVertical: 14, gap: 12 }}
                >
                  <Text className="text-accent-text" style={{ width: 22, fontFamily: FONT.display, fontSize: 15 }}>
                    {index + 1}
                  </Text>
                  <Text className="flex-1 text-ink" style={{ fontFamily: FONT.sans, fontSize: 14, lineHeight: 20 }}>
                    {instruction}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('account.add.removeStep', 'Remove step')}
                    onPress={() => removeInstruction(index)}
                    hitSlop={12}
                  >
                    <Icon name="close" size="sm" color="muted" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          <UInput
            label={t('account.add.stepLabel', 'New cooking step')}
            placeholder={t('account.add.stepPlaceholder', 'Add a cooking step...')}
            value={newInstruction}
            onChangeText={setNewInstruction}
            multiline
            right={<UIconButton icon="plus" tone="accent" label={t('account.add.addStep', 'Add step')} onPress={addInstruction} />}
          />

          {/* Tags */}
          <H2>{t('account.add.tags', 'Tags')}</H2>
          {tags.length > 0 ? (
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  icon="close"
                  accessibilityLabel={t('account.add.removeTag', 'Remove tag {{tag}}', { tag })}
                  onPress={() => removeTag(tag)}
                />
              ))}
            </View>
          ) : null}
          <UInput
            label={t('account.add.tagLabel', 'New tag')}
            placeholder={t('account.add.tagPlaceholder', 'Add a tag...')}
            value={newTag}
            onChangeText={setNewTag}
            onSubmitEditing={addTag}
            right={<UIconButton icon="plus" tone="accent" label={t('account.add.addTag', 'Add tag')} onPress={addTag} />}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
