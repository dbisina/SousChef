import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/stores/authStore';
import { useSubscription } from '@/hooks/useSubscription';
import { useThemeColors } from '@/stores/themeStore';
import { getTierFeatures } from '@/services/subscriptionService';
import { PremiumBadge } from '@/components/subscription';
import { useRecipeStore } from '@/stores/recipeStore';
import { usePantryStore } from '@/stores/pantryStore';

interface MenuItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  route: string;
  color: string;
  badge?: number;
}

interface QuickAction {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
  gradient: [string, string];
}

export default function MoreScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { subscriptionTier, isSubscribed } = useSubscription();
  const adFree = getTierFeatures(subscriptionTier).adFree;
  const colors = useThemeColors();
  const { recipes } = useRecipeStore();
  const { items: pantryItems } = usePantryStore();

  const quickActions: QuickAction[] = [
    { id: 'browse', icon: 'compass', label: 'Discover', route: '/(tabs)/browse', gradient: ['#6366F1', '#818CF8'] },
    { id: 'mealplan', icon: 'calendar', label: 'Meal Plan', route: '/(tabs)/mealplan', gradient: ['#10B981', '#34D399'] },
    { id: 'cookbooks', icon: 'library', label: 'Cookbooks', route: '/cookbook-library', gradient: ['#F59E0B', '#FBBF24'] },
    { id: 'saved', icon: 'bookmark', label: 'Saved', route: '/want-to-cook', gradient: ['#F97316', '#FB923C'] },
  ];


  const renderMenuItem = (item: MenuItem) => (
    <TouchableOpacity
      key={item.id}
      onPress={() => router.push(item.route as any)}
      className="flex-row items-center py-3 px-4"
      activeOpacity={0.7}
    >
      <View
        className="w-9 h-9 rounded-xl items-center justify-center mr-3"
        style={{ backgroundColor: item.color + '15' }}
      >
        <Ionicons name={item.icon} size={18} color={item.color} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-medium text-neutral-800 dark:text-neutral-100">
          {item.label}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-5 pt-2 pb-4">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">More</Text>
        </View>

        {/* User card */}
        {user && (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile' as any)}
            activeOpacity={0.85}
            className="mx-5 mb-5 rounded-2xl overflow-hidden"
          >
            <LinearGradient
              colors={[colors.accent, colors.accent + 'CC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="rounded-2xl p-4 flex-row items-center"
              style={styles.userCard}
            ><View className="p-4 flex-row items-center">
              {user.photoURL ? (
                <Image
                  source={{ uri: user.photoURL }}
                  className="w-12 h-12 rounded-full border-2 border-white/30"
                />
              ) : (
                <View className="w-20 h-20 rounded-full bg-white/20 items-center justify-center border-2 border-white/30">
                  <Text className="text-xl font-bold text-white">
                    {user.displayName?.charAt(0).toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              <View className="flex-1 ml-3">
                <View className="flex-row items-center">
                  <Text className="text-base font-bold text-white mr-2">
                    {user.displayName}
                  </Text>
                  {isSubscribed && <PremiumBadge tier={subscriptionTier} size="small" />}
                </View>
                <Text className="text-white/70 text-sm">{user.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Quick Stats */}
        <View className="flex-row mx-5 mb-5">
          <View className="flex-1 bg-white dark:bg-neutral-800 rounded-3xl p-5 mr-2" style={styles.card}>
            <View className="flex-row items-center mb-1">
              <Ionicons name="restaurant" size={16} color="#FF6B35" />
              <Text className="text-2xl font-bold text-neutral-900 dark:text-white ml-2">{recipes.length}</Text>
            </View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Recipes Saved</Text>
          </View>
          <View className="flex-1 bg-white dark:bg-neutral-800 rounded-3xl p-5 ml-2" style={styles.card}>
            <View className="flex-row items-center mb-1">
              <Ionicons name="basket" size={16} color="#10B981" />
              <Text className="text-2xl font-bold text-neutral-900 dark:text-white ml-2">{pantryItems.length}</Text>
            </View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Pantry Items</Text>
          </View>
        </View>

        {/* Quick Actions Grid */}
        <View className="px-5 mb-2">
          <Text className="text-sm font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-3 ml-1">
            Quick Access
          </Text>
        </View>
        <View className="flex-row flex-wrap mx-4 mb-5 rounded-xl overflow-hidden" style={styles.card}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.85}
              className="w-1/2 p-1 rounded-xl"
            >
              <LinearGradient
                colors={action.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="rounded-2xl p-5 items-center justify-center h-28"
                style={styles.actionCard}
              ><View className="rounded-xl overflow-hidden p-4">
                <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mb-2">
                  <Ionicons name={action.icon} size={22} color="white" />
                </View>
                <Text className="text-white font-semibold text-sm">{action.label}</Text>
              </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>


        {/* Settings */}
        <View className="px-5 mb-2">
          <Text className="text-sm font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2 ml-1">
            Settings
          </Text>
        </View>
        <View className="mx-5 bg-white dark:bg-neutral-800 rounded-3xl overflow-hidden mb-5" style={styles.card}>
          {([
            { id: 'appearance', icon: 'color-palette' as const, label: 'Appearance', subtitle: 'Theme & display', route: '/settings/appearance', color: '#8B5CF6' },
            { id: 'dietary', icon: 'leaf' as const, label: 'Diet Preferences', subtitle: 'Allergies & restrictions', route: '/settings/dietary', color: '#10B981' },
            { id: 'voice', icon: 'mic' as const, label: 'Voice Commands', subtitle: 'Hands-free cooking', route: '/settings/voice', color: '#EC4899' },
            { id: 'notifications', icon: 'notifications' as const, label: 'Notifications', subtitle: 'Alerts & reminders', route: '/settings/notifications', color: '#3B82F6' },
            { id: 'subscription', icon: 'diamond' as const, label: 'Subscription', subtitle: 'Manage your plan', route: '/subscription', color: '#F97316' },
          ] as MenuItem[]).map((item, idx, arr) => (
            <View key={item.id}>
              {renderMenuItem(item)}
              {idx < arr.length - 1 && (
                <View className="h-px bg-neutral-100 dark:bg-neutral-700 ml-14 mr-4" />
              )}
            </View>
          ))}
        </View>

        {/* Admin section — only for admin users */}
        {user?.role === 'admin' && (
          <>
            <View className="px-5 mb-2">
              <Text className="text-sm font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2 ml-1">
                Admin
              </Text>
            </View>
            <View className="mx-5 bg-white dark:bg-neutral-800 rounded-3xl overflow-hidden mb-5" style={styles.card}>
              {[
                { id: 'add-recipe', icon: 'add-circle' as const, label: 'Add Recipe', route: '/admin/add-recipe', color: '#10B981' },
                { id: 'seed', icon: 'server' as const, label: 'Seed Database', route: '/admin/seed', color: '#6366F1' },
                { id: 'analytics', icon: 'bar-chart' as const, label: 'Analytics', route: '/settings/analytics', color: '#3B82F6' },
                { id: 'ads', icon: 'megaphone' as const, label: 'Manage Ads', route: '/admin/manage-ads', color: '#F59E0B' },
              ].map((item, idx, arr) => (
                <View key={item.id}>
                  {renderMenuItem(item as MenuItem)}
                  {idx < arr.length - 1 && (
                    <View className="h-px bg-neutral-100 dark:bg-neutral-700 ml-14 mr-4" />
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  userCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  actionCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
});
