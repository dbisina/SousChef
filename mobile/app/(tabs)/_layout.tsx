import { Tabs } from 'expo-router';
import { TabBar } from '@/components/ui/TabBar';

/**
 * Visible tabs: index, kitchen, play, you (+ Create, which opens /create as a modal and is not a tab screen).
 * Every other tab file stays routable as a hidden tab.
 */
export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="kitchen" options={{ title: 'Kitchen' }} />
      <Tabs.Screen name="play" options={{ title: 'Play' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
      {/* Hidden tabs: reachable by navigation only */}
      <Tabs.Screen name="pantry" options={{ href: null }} />
      <Tabs.Screen name="scan" options={{ href: null }} />
      <Tabs.Screen name="shopping" options={{ href: null }} />
      <Tabs.Screen name="more" options={{ href: null }} />
      <Tabs.Screen name="browse" options={{ href: null }} />
      <Tabs.Screen name="mealplan" options={{ href: null }} />
      <Tabs.Screen name="upload" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
