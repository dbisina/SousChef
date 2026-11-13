import { useRouter } from 'expo-router';
import { Muted, Screen, TopBar } from '@/components/ui';

export default function PostDetailScreen() {
  const router = useRouter();
  return (
    <Screen>
      <TopBar title="Post" onBack={() => router.back()} />
      <Muted>Coming in redesign</Muted>
    </Screen>
  );
}
