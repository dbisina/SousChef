import { useRouter } from 'expo-router';
import { Muted, Screen, TopBar } from '@/components/ui';

export default function MysteryRevealScreen() {
  const router = useRouter();
  return (
    <Screen>
      <TopBar title="Mystery Kitchen" onBack={() => router.back()} />
      <Muted>Coming in redesign</Muted>
    </Screen>
  );
}
