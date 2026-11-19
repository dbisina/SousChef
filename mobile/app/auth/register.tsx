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
import { Field, FONT, H1, Dim, Icon, Muted, PhotoCard, Screen, TopBar, UButton, type PhotoSource } from '@/components/ui';
import { PHOTOS } from '@/assets/photos';
import { SocialButtons } from '@/components/auth/SocialButtons';

const registerSchema = z
  .object({
    displayName: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

function EyeToggle({ shown, onPress, label }: { shown: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={shown ? 'eyeOff' : 'eye'} size="sm" color="muted" />
    </Pressable>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { signUp, isLoading, error } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await signUp(data.email, data.password, data.displayName);
      router.replace('/setup');
    } catch (err) {
      // Error is handled by the store
    }
  };

  return (
    <Screen bare>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <TopBar onBack={() => router.back()} backLabel={t('welcome.back', 'Back')} title={null} />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, gap: 15, paddingBottom: Math.max(insets.bottom, 20) + 4 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PhotoCard source={PHOTOS.salad as PhotoSource} fade="both" height={170} radius={28} accessibilityLabel={t('welcome.register.line2', 'account')} />
          <View style={{ gap: 8, marginTop: 4, marginBottom: 8 }}>
            <H1 style={{ fontSize: 36, lineHeight: 39, letterSpacing: -1.08 }}>
              <Dim>{t('welcome.register.line1', 'Create your')}</Dim>
              {'\n'}
              {t('welcome.register.line2', 'account')}
            </H1>
            <Muted style={{ fontSize: 15, lineHeight: 22 }}>
              {t('welcome.register.subtitle', 'Save recipes and sync them across devices.')}
            </Muted>
          </View>

          {error ? (
            <View className="bg-tag-r" style={{ borderRadius: 18, padding: 14 }}>
              <RNText className="text-tag-r-fg" style={{ fontFamily: FONT.sans, fontSize: 13 }}>
                {error}
              </RNText>
            </View>
          ) : null}

          <Controller
            control={control}
            name="displayName"
            render={({ field: { onChange, onBlur, value } }) => (
              <Field
                label={t('welcome.register.name', 'Full Name')}
                placeholder="John Doe"
                autoCapitalize="words"
                autoComplete="name"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.displayName?.message}
              />
            )}
          />

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
                  placeholder={t('welcome.register.passwordPlaceholder', 'Create a password')}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  trailing={
                    <EyeToggle
                    shown={showPassword}
                    onPress={() => setShowPassword((v) => !v)}
                    label={showPassword ? t('welcome.hidePassword', 'Hide password') : t('welcome.showPassword', 'Show password')}
                    />
                  }
                />
              </View>
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <View>
                <Field
                  label={t('welcome.register.confirm', 'Confirm Password')}
                  placeholder={t('welcome.register.confirmPlaceholder', 'Confirm your password')}
                  secureTextEntry={!showConfirmPassword}
                  autoComplete="new-password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.confirmPassword?.message}
                  trailing={
                    <EyeToggle
                    shown={showConfirmPassword}
                    onPress={() => setShowConfirmPassword((v) => !v)}
                    label={
                    showConfirmPassword ? t('welcome.hidePassword', 'Hide password') : t('welcome.showPassword', 'Show password')
                    }
                    />
                  }
                />
              </View>
            )}
          />

          <UButton
            variant="accent"
            label={t('welcome.register.create', 'Create Account')}
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            style={{ marginTop: 6 }}
          />

          <View className="flex-row items-center" style={{ gap: 12, height: 17 }}>
            <View className="flex-1 bg-divider" style={{ height: 1 }} />
            <Muted small>{t('welcome.login.or', 'or')}</Muted>
            <View className="flex-1 bg-divider" style={{ height: 1 }} />
          </View>

          <SocialButtons verb="Sign up" />

          <Muted small center>
            {t('welcome.register.termsPrefix', 'By continuing you agree to our')}{' '}
            <RNText
              accessibilityRole="link"
              style={{ textDecorationLine: 'underline' }}
              onPress={() => router.push('/settings/terms')}
            >
              {t('welcome.register.terms', 'Terms of Service')}
            </RNText>{' '}
            {t('welcome.register.and', 'and')}{' '}
            <RNText
              accessibilityRole="link"
              style={{ textDecorationLine: 'underline' }}
              onPress={() => router.push('/settings/privacy')}
            >
              {t('welcome.register.privacy', 'Privacy Policy')}
            </RNText>
          </Muted>

          <View className="flex-row justify-center items-center" style={{ marginTop: 'auto', paddingTop: 12 }}>
            <Muted>{t('welcome.register.haveAccount', 'Already have an account?')} </Muted>
            <Pressable accessibilityRole="link" onPress={() => router.replace('/auth/login')} hitSlop={10}>
              <RNText className="text-ink" style={{ fontFamily: FONT.sansMedium, fontSize: 14 }}>
                {t('welcome.register.signIn', 'Sign in')}
              </RNText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
