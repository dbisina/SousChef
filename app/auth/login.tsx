import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuthStore } from '@/stores/authStore';
import { useThemeColors } from '@/stores/themeStore';
import { Button, Input } from '@/components/ui';
import {
  signInWithGoogle,
  signInWithApple,
  useGoogleAuth,
  isAppleSignInAvailable,
} from '@/services/socialAuthService';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, setUser, resetPassword, isLoading, error } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const colors = useThemeColors();

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
        Alert.alert('Sign In Failed', result.error || 'Failed to sign in with Google');
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred');
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
        Alert.alert('Sign In Failed', result.error || 'Failed to sign in with Apple');
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setSocialLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = getValues('email');
    if (!email) {
      Alert.alert('Email Required', 'Please enter your email address first.');
      return;
    }
    try {
      await resetPassword(email);
      Alert.alert('Email Sent', 'Check your inbox for password reset instructions.');
    } catch (err) {
      Alert.alert('Error', 'Failed to send reset email. Please try again.');
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

  const onSubmit = async (data: LoginFormData) => {
    try {
      await signIn(data.email, data.password);
      router.replace('/(tabs)');
    } catch (err) {
      // Error is handled by the store
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 py-8">
            {/* Logo/Header */}
            <View className="items-center mb-8">
              <Image
                source={require('../../assets/icon.png')}
                className="w-28 h-28 mb-4"
                resizeMode="contain"
              />
              <Text className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
                SousChef
              </Text>
              <Text className="text-neutral-500 dark:text-neutral-400 mt-2">
                Your AI-powered cooking companion
              </Text>
            </View>

            {/* Form */}
            <View className="flex-1">
              <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mb-6">
                Welcome back
              </Text>

              {error && (
                <View className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
                  <Text className="text-red-600 dark:text-red-400">{error}</Text>
                </View>
              )}

              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Email"
                    placeholder="your@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    leftIcon="mail-outline"
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
                  <Input
                    label="Password"
                    placeholder="Enter your password"
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    leftIcon="lock-closed-outline"
                    rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    onRightIconPress={() => setShowPassword(!showPassword)}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.password?.message}
                  />
                )}
              />

              <TouchableOpacity className="self-end mb-6" onPress={handleForgotPassword}>
                <Text className="font-medium" style={{ color: colors.accent }}>
                  Forgot password?
                </Text>
              </TouchableOpacity>

              <Button
                title="Sign In"
                onPress={handleSubmit(onSubmit)}
                isLoading={isLoading}
                fullWidth
              />

              {/* Divider */}
              <View className="flex-row items-center my-6">
                <View className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                <Text className="mx-4 text-neutral-500 dark:text-neutral-400">or</Text>
                <View className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
              </View>

              {/* Social login buttons */}
              <Button
                title="Continue with Google"
                variant="outline"
                leftIcon={
                  <Ionicons name="logo-google" size={20} color="#DB4437" />
                }
                onPress={() => googlePromptAsync()}
                isLoading={socialLoading}
                disabled={!googleReady}
                fullWidth
              />

              {appleAvailable && (
                <View className="mt-3">
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={12}
                    style={{ width: '100%', height: 50 }}
                    onPress={handleAppleSignIn}
                  />
                </View>
              )}

              {/* Guest mode */}
              <TouchableOpacity
                className="mt-4 py-3 items-center"
                onPress={() => {
                  useAuthStore.getState().continueAsGuest();
                  router.replace('/(tabs)');
                }}
              >
                <Text className="text-neutral-500 dark:text-neutral-400 font-medium">
                  Skip for now — try it first
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sign up link */}
            <View className="flex-row justify-center mt-8">
              <Text className="text-neutral-500 dark:text-neutral-400">Don't have an account? </Text>
              <Link href="/auth/register" asChild>
                <TouchableOpacity>
                  <Text className="font-semibold" style={{ color: colors.accent }}>Sign up</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
