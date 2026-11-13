import { useRouter } from 'expo-router';
import { Muted, Screen, TopBar } from '@/components/ui';

export default function HealthLogScreen() {
  const router = useRouter();
  return (
    <Screen>
      <TopBar title="Log a reading" onBack={() => router.back()} />
      <Muted>Coming in redesign</Muted>
    </Screen>
  );
}
