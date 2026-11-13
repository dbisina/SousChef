import { useRouter } from 'expo-router';
import { Muted, Screen, TopBar } from '@/components/ui';

export default function MessagesScreen() {
  const router = useRouter();
  return (
    <Screen>
      <TopBar title="Messages" onBack={() => router.back()} />
      <Muted>Coming in redesign</Muted>
    </Screen>
  );
}
