import { useRouter } from 'expo-router';
import { Muted, Screen, TopBar } from '@/components/ui';

export default function HealthReportScreen() {
  const router = useRouter();
  return (
    <Screen>
      <TopBar title="Doctor report" onBack={() => router.back()} />
      <Muted>Coming in redesign</Muted>
    </Screen>
  );
}
