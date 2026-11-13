import { useRouter } from 'expo-router';
import { Muted, Screen, TopBar } from '@/components/ui';

export default function OrderSheetScreen() {
  const router = useRouter();
  return (
    <Screen>
      <TopBar title="Order" onBack={() => router.back()} />
      <Muted>Coming in redesign</Muted>
    </Screen>
  );
}
