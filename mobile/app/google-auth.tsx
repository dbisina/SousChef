import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

/**
 * Android Google sign-in comes back to the app through enplace://google-auth (see services/socialAuthService.ts). The sign-in
 * code reads the result from the browser session itself; this screen only exists so the link does not land on "Unmatched
 * Route". It steps straight back (or to home when the app was opened cold by the link).
 */
export default function GoogleAuthReturn() {
  const router = useRouter();
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
    // Runs once when the link opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <View style={{ flex: 1 }} />;
}
