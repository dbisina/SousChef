import { useRouter } from 'expo-router';
import { Muted, Screen, TopBar } from '@/components/ui';

export default function CommunityScreen() {
  const router = useRouter();
  return (
    <Screen>
      <TopBar title="Community" onBack={() => router.back()} />
      <Muted>Coming in redesign</Muted>
    </Screen>
  );
}
