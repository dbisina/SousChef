import { useRouter } from 'expo-router';
import { Muted, Screen, TopBar } from '@/components/ui';

export default function StoryScreen() {
  const router = useRouter();
  return (
    <Screen tone="dark">
      <TopBar title="Story" onBack={() => router.back()} />
      <Muted>Coming in redesign</Muted>
    </Screen>
  );
}
