import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as AppleAuthentication from 'expo-apple-authentication';
import { UButton } from '@/components/ui';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { showErrorToast } from '@/stores/toastStore';
import { googleTokensFrom, isAppleSignInAvailable, signInWithApple, signInWithGoogle, useGoogleAuth } from '@/services/socialAuthService';

/**
 * "Continue with Google" and "Continue with Apple". Both do sign-in and sign-up in one step (a new person gets an account),
 * so the same block sits on the login and the sign-up screens. Every failure shows a message; nothing fails silently.
 */
export function SocialButtons({ verb = 'Continue' }: { verb?: 'Continue' | 'Sign up' }) {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.effectiveTheme);
  const setUser = useAuthStore((s) => s.setUser);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const { response, promptAsync, isReady } = useGoogleAuth();

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const finish = (result: { success: boolean; user?: unknown; error?: string }, provider: string) => {
    if (result.success && result.user) {
      setUser(result.user as Parameters<typeof setUser>[0]);
      router.replace('/(tabs)');
    } else if (result.error !== 'cancelled') {
      showErrorToast(result.error || `We couldn't sign you in with ${provider}. Try again?`, 'Sign in issue');
    }
  };

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const { idToken, accessToken } = googleTokensFrom(response);
      setBusy(true);
      signInWithGoogle(idToken, accessToken)
        .then((r) => finish(r, 'Google'))
        .catch(() => showErrorToast('Something unexpected happened. Try another way?', 'Oops'))
        .finally(() => setBusy(false));
    } else if (response.type === 'error') {
      showErrorToast(response.error?.message || 'Google did not finish signing you in. Try again?', 'Sign in issue');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const onGoogle = async () => {
    if (!isReady) {
      showErrorToast('Google sign-in is not ready yet. Give it a second and try again.', 'Sign in issue');
      return;
    }
    try {
      await promptAsync();
    } catch {
      showErrorToast('We could not open Google. Try again?', 'Sign in issue');
    }
  };

  const onApple = async () => {
    setBusy(true);
    try {
      finish(await signInWithApple(), 'Apple');
    } catch {
      showErrorToast('Something unexpected happened. Try another way?', 'Oops');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <UButton
        variant="ghost"
        icon="globe"
        label={verb === 'Sign up' ? t('welcome.register.google', 'Sign up with Google') : t('welcome.login.google', 'Continue with Google')}
        onPress={onGoogle}
        loading={busy}
      />
      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            verb === 'Sign up'
              ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
              : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
          }
          buttonStyle={
            theme === 'dark'
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={29}
          style={{ alignSelf: 'stretch', width: '100%', height: 58 }}
          onPress={onApple}
        />
      ) : null}
    </View>
  );
}
