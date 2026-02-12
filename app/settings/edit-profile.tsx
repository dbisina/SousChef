import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/stores/authStore';
import { useThemeColors } from '@/stores/themeStore';
import { uploadImage } from '@/lib/cloudinary';
import { Avatar, Button, Input, Card } from '@/components/ui';
import { showSuccessToast, showErrorToast, showInfoToast } from '@/stores/toastStore';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateUserProfile, isLoading } = useAuthStore();
  const colors = useThemeColors();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [isUploading, setIsUploading] = useState(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setIsUploading(true);
      try {
        const uploadedUrl = await uploadImage(
          result.assets[0].uri,
          `souschef/avatars/${user?.id}`
        );
        setPhotoURL(uploadedUrl);
      } catch (error) {
        showErrorToast('We couldn\'t upload your new photo just yet. Want to try again? 📸', 'Upload Problem');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      showInfoToast('Wait! We need to know what to call you! 🖊️', 'Name Needed');
      return;
    }

    try {
      await updateUserProfile({
        displayName: displayName.trim(),
        photoURL: photoURL || undefined,
      });
      showSuccessToast('Looking good! Your profile has been updated. ✨', 'Profile Saved');
      router.back();
    } catch (error) {
      showErrorToast('Oops! We couldn\'t save your profile changes. Let\'s try once more? 🔄', 'Update Problem');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 bg-white dark:bg-neutral-800">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <Ionicons name="arrow-back" size={24} color={colors.icon} />
          </TouchableOpacity>
          <Text className="flex-1 text-lg font-bold text-neutral-900 dark:text-neutral-50 ml-2">
            Edit Profile
          </Text>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="p-4">
            {/* Avatar section */}
            <View className="items-center py-6">
              <TouchableOpacity onPress={handlePickImage} disabled={isUploading}>
                <View className="relative">
                  <Avatar
                    name={displayName}
                    imageUrl={photoURL}
                    size="xl"
                  />
                  <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full items-center justify-center border-2 border-white dark:border-neutral-900" style={{ backgroundColor: colors.accent }}>
                    <Ionicons name="camera" size={16} color="white" />
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePickImage} disabled={isUploading}>
                <Text className="font-medium mt-3" style={{ color: colors.accent }}>
                  {isUploading ? 'Uploading...' : 'Change Photo'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <Card>
              <Input
                label="Display Name"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter your name"
                autoCapitalize="words"
              />

              <View className="mt-4">
                <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Email
                </Text>
                <View className="bg-neutral-100 dark:bg-neutral-700 rounded-xl px-4 py-3">
                  <Text className="text-neutral-500 dark:text-neutral-400">{user?.email}</Text>
                </View>
                <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                  Email cannot be changed
                </Text>
              </View>

              {user?.role && (
                <View className="mt-4">
                  <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Account Type
                  </Text>
                  <View className="flex-row items-center bg-neutral-100 dark:bg-neutral-700 rounded-xl px-4 py-3">
                    <Ionicons
                      name={user.role === 'admin' ? 'shield-checkmark' : user.role === 'chef' ? 'restaurant' : 'person'}
                      size={18}
                      color={colors.accent}
                    />
                    <Text className="text-neutral-700 dark:text-neutral-300 ml-2 capitalize">{user.role}</Text>
                  </View>
                </View>
              )}
            </Card>

            {/* Save button */}
            <View className="mt-6">
              <Button
                title="Save Changes"
                onPress={handleSave}
                isLoading={isLoading}
                fullWidth
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
