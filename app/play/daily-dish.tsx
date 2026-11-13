import { useRouter } from 'expo-router';
import { Muted, Screen, TopBar } from '@/components/ui';

export default function DailyDishScreen() {
  const router = useRouter();
  return (
    <Screen>
      <TopBar title="Daily dish" onBack={() => router.back()} />
      <Muted>Coming in redesign</Muted>
    </Screen>
  );
}
