import { useRouter } from 'expo-router';
import { Muted, Screen, TopBar } from '@/components/ui';

export default function OrderTrackingScreen() {
  const router = useRouter();
  return (
    <Screen>
      <TopBar title="Order tracking" onBack={() => router.back()} />
      <Muted>Coming in redesign</Muted>
    </Screen>
  );
}
