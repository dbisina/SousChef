import { useRouter } from 'expo-router';
import { Muted, Screen, TopBar } from '@/components/ui';

export default function ReelsScreen() {
  const router = useRouter();
  return (
    <Screen tone="dark">
      <TopBar title="Reels" onBack={() => router.back()} />
      <Muted>Coming in redesign</Muted>
    </Screen>
  );
}
