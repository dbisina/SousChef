import { useRouter } from 'expo-router';
import { Muted, Screen, TopBar } from '@/components/ui';

export default function SetupScreen() {
  const router = useRouter();
  return (
    <Screen>
      <TopBar title="Setup" onBack={() => router.back()} />
      <Muted>Coming in redesign</Muted>
    </Screen>
  );
}
