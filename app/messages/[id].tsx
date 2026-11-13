import { useRouter } from 'expo-router';
import { Muted, Screen, TopBar } from '@/components/ui';

export default function ChatScreen() {
  const router = useRouter();
  return (
    <Screen>
      <TopBar title="Chat" onBack={() => router.back()} />
      <Muted>Coming in redesign</Muted>
    </Screen>
  );
}
