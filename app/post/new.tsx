import { useRouter } from 'expo-router';
import { Muted, Screen, TopBar } from '@/components/ui';

export default function NewPostScreen() {
  const router = useRouter();
  return (
    <Screen>
      <TopBar title="New post" onBack={() => router.back()} />
      <Muted>Coming in redesign</Muted>
    </Screen>
  );
}
