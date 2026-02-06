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
import { uploadImage } from '@/lib/cloudinary';
import { Avatar, Button, Input, Card } from '@/components/ui';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateUserProfile, isLoading } = useAuthStore();

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
        Alert.alert('Error', 'Failed to upload image. Please try again.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Display name is required');
      return;
    }

    try {
      await updateUserProfile({
        displayName: displayName.trim(),
        photoURL: photoURL || undefined,
      });
      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-neutral-100 bg-white">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <Ionicons name="arrow-back" size={24} color="#404040" />
          </TouchableOpacity>
          <Text className="flex-1 text-lg font-bold text-neutral-900 ml-2">
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
                  <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary-500 items-center justify-center border-2 border-white">
                    <Ionicons name="camera" size={16} color="white" />
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePickImage} disabled={isUploading}>
                <Text className="text-primary-500 font-medium mt-3">
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
                <Text className="text-sm font-medium text-neutral-700 mb-2">
                  Email
                </Text>
                <View className="bg-neutral-100 rounded-xl px-4 py-3">
                  <Text className="text-neutral-500">{user?.email}</Text>
                </View>
                <Text className="text-xs text-neutral-400 mt-1">
                  Email cannot be changed
                </Text>
              </View>

              {user?.role && (
                <View className="mt-4">
                  <Text className="text-sm font-medium text-neutral-700 mb-2">
                    Account Type
                  </Text>
                  <View className="flex-row items-center bg-neutral-100 rounded-xl px-4 py-3">
                    <Ionicons
                      name={user.role === 'admin' ? 'shield-checkmark' : user.role === 'chef' ? 'restaurant' : 'person'}
                      size={18}
                      color="#FF6B35"
                    />
                    <Text className="text-neutral-700 ml-2 capitalize">{user.role}</Text>
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
