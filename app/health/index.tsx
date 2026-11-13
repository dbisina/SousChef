import { useRouter } from 'expo-router';
import { Muted, Screen, TopBar } from '@/components/ui';

export default function HealthScreen() {
  const router = useRouter();
  return (
    <Screen>
      <TopBar title="Health" onBack={() => router.back()} />
      <Muted>Coming in redesign</Muted>
    </Screen>
  );
}
