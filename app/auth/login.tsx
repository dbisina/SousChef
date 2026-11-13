import React, { useState, useEffect } from 'react';
import { View, Image, Text as RNText, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { Field, FONT, Icon, LinkText, Muted, PhotoCard, Screen, UButton } from '@/components/ui';
import { FIXED } from '@/stores/themeStore';
import { SAMPLE } from '@/assets/sample';
import {
  signInWithGoogle,
  signInWithApple,
  useGoogleAuth,
  isAppleSignInAvailable,
} from '@/services/socialAuthService';
import { showSuccessToast, showErrorToast, showInfoToast } from '@/stores/toastStore';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { signIn, setUser, resetPassword, isLoading, error } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);

  // Google Auth
  const { response: googleResponse, promptAsync: googlePromptAsync, isReady: googleReady } = useGoogleAuth();

  // Check Apple availability
  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  // Handle Google response
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { id_token, access_token } = googleResponse.params;
      handleGoogleSignIn(id_token, access_token);
    }
  }, [googleResponse]);

  const handleGoogleSignIn = async (idToken: string, accessToken: string) => {
    setSocialLoading(true);
    try {
      const result = await signInWithGoogle(idToken, accessToken);
      if (result.success && result.user) {
        setUser(result.user);
        router.replace('/(tabs)');
      } else {
        showErrorToast(result.error || 'We couldn\'t sign you in with Google. Let\'s try again?', 'Sign In Issue');
      }
    } catch (err) {
      showErrorToast('Something unexpected happened. Maybe try another way?', 'Oops!');
    } finally {
      setSocialLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setSocialLoading(true);
    try {
      const result = await signInWithApple();
      if (result.success && result.user) {
        setUser(result.user);
        router.replace('/(tabs)');
      } else if (result.error !== 'cancelled') {
        showErrorToast(result.error || 'Apple Sign In didn\'t work this time. Try again?', 'Sign In Issue');
      }
    } catch (err) {
      showErrorToast('Something unexpected happened. Maybe try another way?', 'Oops!');
    } finally {
      setSocialLoading(false);
    }
  };

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
          contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, 20) + 18 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PhotoCard
            source={SAMPLE.salmon}
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
            <View style={{ position: 'absolute', left: 24, bottom: 24, gap: 4 }}>
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
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleForgotPassword}
                    hitSlop={{ top: 14, bottom: 14, left: 14, right: 4 }}
                    style={{ position: 'absolute', top: 0, right: 4 }}
                  >
                    <LinkText style={{ fontSize: 12 }}>{t('welcome.login.forgot', 'Forgot password?')}</LinkText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword ? t('welcome.hidePassword', 'Hide password') : t('welcome.showPassword', 'Show password')
                    }
                    onPress={() => setShowPassword((v) => !v)}
                    style={{ position: 'absolute', top: 22, right: 6, width: 46, height: 54, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} size="sm" color="muted" />
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

            <View className="flex-row items-center" style={{ gap: 12 }}>
              <View className="flex-1 bg-divider" style={{ height: 1 }} />
              <Muted small>{t('welcome.login.or', 'or')}</Muted>
              <View className="flex-1 bg-divider" style={{ height: 1 }} />
            </View>

            <UButton
              variant="ghost"
              icon="globe"
              label={t('welcome.login.google', 'Continue with Google')}
              onPress={() => googlePromptAsync()}
              loading={socialLoading}
              disabled={!googleReady}
            />

            {appleAvailable ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={29}
                style={{ width: '100%', height: 58 }}
                onPress={handleAppleSignIn}
              />
            ) : null}

            {/* Guest mode */}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                useAuthStore.getState().continueAsGuest();
                router.replace('/(tabs)');
              }}
              style={{ paddingVertical: 12, alignItems: 'center' }}
            >
              <LinkText>{t('welcome.login.skip', 'Skip for now — try it first')}</LinkText>
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
