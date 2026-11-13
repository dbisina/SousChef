import { useRouter } from 'expo-router';
import { Muted, Screen, TopBar } from '@/components/ui';

export default function HealthMealScreen() {
  const router = useRouter();
  return (
    <Screen>
      <TopBar title="Meal response" onBack={() => router.back()} />
      <Muted>Coming in redesign</Muted>
    </Screen>
  );
}
