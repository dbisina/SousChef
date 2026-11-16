import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { apiEnabled } from '@/lib/api';
import { DeleteAccountSheet } from '@/components/settings/DeleteAccountSheet';
import { uploadImage } from '@/lib/cloudinary';
import { uploadFile } from '@/lib/upload';
import {
  CtaBar,
  FONT,
  Field,
  Icon,
  ListRow,
  Muted,
  PhotoCard,
  Rows,
  Screen,
  Tag,
  TopBar,
  UAvatar,
  UButton,
  UIconButton,
} from '@/components/ui';
import { useLanguageStore } from '@/stores/languageStore';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { showSuccessToast, showErrorToast, showInfoToast } from '@/stores/toastStore';

export default function EditProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, updateUserProfile, isLoading } = useAuthStore();
  const language = useLanguageStore((s) => s.language);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [bannerURL, setBannerURL] = useState(user?.bannerURL || '');
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [deleteSheet, setDeleteSheet] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const languageName = SUPPORTED_LANGUAGES.find((l) => l.code === language)?.nativeName ?? language;

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
        const uploadedUrl = apiEnabled()
          ? (await uploadFile(result.assets[0].uri, 'avatar')).url
          : await uploadImage(result.assets[0].uri, `souschef/avatars/${user?.id}`);
        setPhotoURL(uploadedUrl);
      } catch (error) {
        showErrorToast(
          t('account.edit.uploadFailed', "We couldn't upload your new photo just yet. Want to try again?"),
          t('account.edit.uploadProblem', 'Upload Problem')
        );
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handlePickBanner = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setIsUploadingBanner(true);
    try {
      setBannerURL((await uploadFile(result.assets[0].uri, 'banner')).url);
    } catch {
      showErrorToast(
        t('account.edit.bannerFailed', "We couldn't upload your new banner just yet. Want to try again?"),
        t('account.edit.uploadProblem', 'Upload Problem'),
      );
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      showInfoToast(
        t('account.edit.nameNeededBody', 'Wait! We need to know what to call you!'),
        t('account.edit.nameNeeded', 'Name Needed')
      );
      return;
    }

    try {
      await updateUserProfile({
        displayName: displayName.trim(),
        photoURL: photoURL || undefined,
        ...(apiEnabled() ? { bannerURL } : {}),
      });
      showSuccessToast(
        t('account.edit.savedBody', 'Looking good! Your profile has been updated.'),
        t('account.edit.saved', 'Profile Saved')
      );
      router.back();
    } catch (error) {
      showErrorToast(
        t('account.edit.saveFailed', "Oops! We couldn't save your profile changes. Let's try once more?"),
        t('account.edit.updateProblem', 'Update Problem')
      );
    }
  };

  const handleDeleteAccount = () => {
    if (apiEnabled()) {
      setDeleteSheet(true); // the server asks for the password (or the word DELETE) in a sheet
      return;
    }
    Alert.alert(
      t('account.edit.deleteTitle', 'Delete Account'),
      t(
        'account.edit.deleteConfirm',
        'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently lost.'
      ),
      [
        { text: t('account.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('account.delete', 'Delete'),
          style: 'destructive',
          onPress: () => {
            // Second confirmation for safety
            Alert.alert(
              t('account.edit.finalTitle', 'Final Confirmation'),
              t('account.edit.finalBody', 'Type DELETE to confirm account deletion. This is irreversible.'),
              [
                { text: t('account.cancel', 'Cancel'), style: 'cancel' },
                {
                  text: t('account.edit.deleteForever', 'Delete Forever'),
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await useAuthStore.getState().deleteAccount();
                      router.replace('/auth/login');
                    } catch (error) {
                      Alert.alert(
                        t('account.error', 'Error'),
                        t('account.edit.deleteFailed', 'Failed to delete account. You may need to sign in again before deleting.')
                      );
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const roleLabel = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '';

  return (
    <Screen
      bare
      footer={
        <CtaBar fade>
          <UButton label={t('account.edit.save', 'Save Changes')} onPress={handleSave} loading={isLoading} />
        </CtaBar>
      }
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TopBar variant="compact" title={t('account.edit.title', 'Edit Profile')} onBack={() => router.back()} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150, gap: 16 }}
        >
          {apiEnabled() ? (
            <View style={{ gap: 8 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('account.edit.changeBanner', 'Change banner')} onPress={handlePickBanner} disabled={isUploadingBanner}>
                <PhotoCard source={bannerURL ? { uri: bannerURL } : null} height={120} radius={24} fade="none">
                  <View style={{ position: 'absolute', right: 12, bottom: 12 }}>
                    <UIconButton
                      icon="camera"
                      tone="black"
                      label={isUploadingBanner ? t('account.edit.uploading', 'Uploading...') : t('account.edit.changeBanner', 'Change banner')}
                      onPress={handlePickBanner}
                      disabled={isUploadingBanner}
                    />
                  </View>
                </PhotoCard>
              </Pressable>
              {bannerURL ? <UButton size="sm" variant="ghost" label={t('account.edit.removeBanner', 'Remove banner')} onPress={() => setBannerURL('')} /> : null}
            </View>
          ) : null}

          <View style={{ alignSelf: 'center', marginTop: 6, marginBottom: 4 }}>
            <UAvatar
              name={displayName || user?.displayName || ''}
              size={120}
              source={photoURL ? { uri: photoURL } : undefined}
            />
            <View style={{ position: 'absolute', right: -2, bottom: -2 }}>
              <UIconButton
                icon="camera"
                tone="black"
                label={isUploading ? t('account.edit.uploading', 'Uploading...') : t('account.edit.changePhoto', 'Change photo')}
                onPress={handlePickImage}
                disabled={isUploading}
              />
            </View>
          </View>

          <Field
            label={t('account.edit.displayName', 'Display Name')}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t('account.edit.displayNamePlaceholder', 'Enter your name')}
            autoCapitalize="words"
          />

          <View style={{ gap: 7 }}>
            <Field
              label={t('account.edit.email', 'Email')}
              value={user?.email ?? ''}
              editable={false}
              placeholder="you@example.com"
            />
            <View className="flex-row items-center" style={{ gap: 6, paddingStart: 4 }}>
              <Icon name="lock" size="sm" color="muted" />
              <Muted small>{t('account.edit.emailLocked', 'Email cannot be changed')}</Muted>
            </View>
          </View>

          <Rows>
            {user?.role ? (
              <ListRow
                icon="user"
                title={t('account.edit.accountType', 'Account Type')}
                right={<Tag label={roleLabel} />}
              />
            ) : null}
            <ListRow
              icon="globe"
              title={t('account.edit.language', 'Language')}
              right={
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <Muted>{languageName}</Muted>
                  <Icon name="chevronRight" color="subtle" />
                </View>
              }
              onPress={() => router.push('/settings/language')}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('account.edit.deleteTitle', 'Delete Account')}
              onPress={handleDeleteAccount}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="flex-row items-center" style={{ minHeight: 64, gap: 14 }}>
                <View className="items-center justify-center bg-tag-r" style={{ width: 44, height: 44, borderRadius: 22 }}>
                  <Icon name="trash" color="tag-r-fg" />
                </View>
                <View className="flex-1" style={{ gap: 2 }}>
                  <Text className="text-tag-r-fg" style={{ fontFamily: FONT.display, fontSize: 15 }}>
                    {t('account.edit.deleteTitle', 'Delete Account')}
                  </Text>
                  <Muted small>{t('account.edit.deleteBody', 'Permanently remove all data')}</Muted>
                </View>
              </View>
            </Pressable>
          </Rows>
        </ScrollView>
      </KeyboardAvoidingView>
      <DeleteAccountSheet visible={deleteSheet} onClose={() => setDeleteSheet(false)} onDeleted={() => router.replace('/auth/login')} />
    </Screen>
  );
}
