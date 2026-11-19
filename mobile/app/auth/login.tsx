import React, { useState } from 'react';
import { View, Image, Text as RNText, ScrollView, Platform } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Pressable } from '@/components/ui/Pressable';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { Field, FONT, Icon, LinkText, Muted, PhotoCard, Screen, UButton, type PhotoSource } from '@/components/ui';
import { PHOTOS } from '@/assets/photos';
import { FIXED } from '@/stores/themeStore';
import { SocialButtons } from '@/components/auth/SocialButtons';
import { showSuccessToast, showInfoToast } from '@/stores/toastStore';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { signIn, resetPassword, isLoading, error } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleForgotPassword = async () => {
    const email = getValues('email');
    if (!email) {
      showInfoToast('Please enter your email address so we know where to send the link!', 'Email Needed');
      return;
    }
    try {
      await resetPassword(email);
      showSuccessToast('Check your inbox for password reset instructions. It\'s on the way!', 'Email Sent');
    } catch (err) {
      // Error handled by store
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    try {
      await signIn(data.email, data.password);
      router.replace('/(tabs)');
    } catch (err) {
      // Error is handled by the store
    }
  };

  return (
    <Screen bare>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, 20) + 4 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PhotoCard
            source={PHOTOS.pasta as PhotoSource}
            fade="both"
            height={300}
            radius={0}
            style={{ borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }}
          >
            <View style={{ position: 'absolute', top: Math.max(insets.top, 20) + 14, left: 20 }}>
              <Image
                source={require('../../assets/icon.png')}
                accessibilityLabel=""
                style={{ width: 42, height: 42, borderRadius: 13 }}
              />
            </View>
            <View style={{ position: 'absolute', left: 24, bottom: 26, gap: 5 }}>
              <RNText
                accessibilityRole="header"
                style={{ fontFamily: FONT.display, fontSize: 30, lineHeight: 34.5, letterSpacing: -0.6, color: FIXED.paper }}
              >
                {t('welcome.login.title', 'Welcome back')}
              </RNText>
              <RNText style={{ fontFamily: FONT.sans, fontSize: 14, color: FIXED.captionSub }}>
                {t('welcome.login.subtitle', 'Your cooking companion')}
              </RNText>
            </View>
          </PhotoCard>

          <View style={{ paddingTop: 26, paddingHorizontal: 24, gap: 16 }}>
            {error ? (
              <View className="bg-tag-r" style={{ borderRadius: 18, padding: 14 }}>
                <RNText className="text-tag-r-fg" style={{ fontFamily: FONT.sans, fontSize: 13 }}>
                  {error}
                </RNText>
              </View>
            ) : null}

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label={t('welcome.login.email', 'Email')}
                  placeholder="your@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <View>
                  <Field
                    label={t('welcome.login.password', 'Password')}
                    placeholder={t('welcome.login.passwordPlaceholder', 'Enter your password')}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.password?.message}
                    trailing={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={showPassword ? t('welcome.hidePassword', 'Hide password') : t('welcome.showPassword', 'Show password')}
                        onPress={() => setShowPassword((v) => !v)}
                        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Icon name={showPassword ? 'eyeOff' : 'eye'} size="sm" color="muted" />
                      </Pressable>
                    }
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleForgotPassword}
                    hitSlop={{ top: 14, bottom: 14, left: 14, right: 4 }}
                    style={{ position: 'absolute', top: 0, right: 0 }}
                  >
                    <LinkText style={{ fontSize: 12 }}>{t('welcome.login.forgot', 'Forgot password?')}</LinkText>
                  </Pressable>
                </View>
              )}
            />

            <UButton
              label={t('welcome.login.signIn', 'Sign In')}
              onPress={handleSubmit(onSubmit)}
              loading={isLoading}
              style={{ marginTop: 4 }}
            />

            <View className="flex-row items-center" style={{ gap: 12, height: 17 }}>
              <View className="flex-1 bg-divider" style={{ height: 1 }} />
              <Muted small>{t('welcome.login.or', 'or')}</Muted>
              <View className="flex-1 bg-divider" style={{ height: 1 }} />
            </View>

            <SocialButtons />

            {/* Guest mode */}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                useAuthStore.getState().continueAsGuest();
                router.replace('/(tabs)');
              }}
              style={{ paddingVertical: 12, alignItems: 'center' }}
            >
              <LinkText>{t('welcome.login.skip', 'Skip for now, try it first')}</LinkText>
            </Pressable>
          </View>

          <View className="flex-row justify-center items-center" style={{ marginTop: 'auto', paddingTop: 20 }}>
            <Muted>{t('welcome.login.noAccount', 'Don’t have an account?')} </Muted>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/auth/register')}
              hitSlop={10}
            >
              <RNText className="text-ink" style={{ fontFamily: FONT.sansMedium, fontSize: 14 }}>
                {t('welcome.login.signUp', 'Sign up')}
              </RNText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
