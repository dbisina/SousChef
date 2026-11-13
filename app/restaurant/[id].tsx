import { useRouter } from 'expo-router';
import { Muted, Screen, TopBar } from '@/components/ui';

export default function RestaurantScreen() {
  const router = useRouter();
  return (
    <Screen>
      <TopBar title="Restaurant" onBack={() => router.back()} />
      <Muted>Coming in redesign</Muted>
    </Screen>
  );
}
