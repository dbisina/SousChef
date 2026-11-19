import { Alert } from 'react-native';
import { router } from 'expo-router';
import i18n from '@/lib/i18n';
import { apiEnabled } from '@/lib/api';
import { isGuestSession } from '@/lib/session';

/**
 * Liking, saving, commenting, following and joining need an account on the server. A guest has none, so instead of a tap that
 * silently snaps back they are asked to sign up. Returns true when the action must stop here.
 */
export function guestBlocked(): boolean {
  if (!apiEnabled() || !isGuestSession()) return false;
  Alert.alert(
    i18n.t('guestGate.title', 'Create an account'),
    i18n.t('guestGate.body', 'Likes, saves, comments and follows need an account, so they stay with you on every device.'),
    [
      { text: i18n.t('guestGate.later', 'Not now'), style: 'cancel' },
      { text: i18n.t('guestGate.signUp', 'Sign up'), onPress: () => router.push('/auth/login') },
    ],
  );
  return true;
}
