import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/stores/authStore';
import { useMyRecipes } from '@/hooks/useRecipes';
import { useSubscription } from '@/hooks/useSubscription';
import { useThemeColors } from '@/stores/themeStore';
import { Avatar, Card, Button, AdMobBanner } from '@/components/ui';
import { getTierFeatures } from '@/services/subscriptionService';
import { RecipeCard } from '@/components/recipe';
import { PremiumBadge, SubscriptionCard, Paywall } from '@/components/subscription';

interface ColorMenuItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  route: string;
  color: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, isLoading, isGuest } = useAuthStore();
  const colors = useThemeColors();
  const [showPaywall, setShowPaywall] = useState(false);

  // Only load user-specific data for authenticated (non-guest) users
  const { recipes: myRecipes, isLoading: recipesLoading } = useMyRecipes();
  const { subscriptionTier, isSubscribed } = useSubscription();
  const adFree = isGuest ? false : getTierFeatures(subscriptionTier).adFree;

  const handleSignOut = () => {
    if (isGuest) {
      // Guest users just reset state and go to login
      useAuthStore.getState().setUser(null);
      router.replace('/auth/login');
      return;
    }
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Second confirmation for safety
            Alert.alert(
              'Final Confirmation',
              'Type DELETE to confirm account deletion. This is irreversible.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await useAuthStore.getState().deleteAccount();
                      router.replace('/auth/login');
                    } catch (error) {
                      Alert.alert('Error', 'Failed to delete account. You may need to sign in again before deleting.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900 items-center justify-center px-4">
        <Text className="text-lg text-neutral-600 dark:text-neutral-400 mb-4">Please sign in to view your profile</Text>
        <Button title="Sign In" onPress={() => router.push('/auth/login')} />
      </SafeAreaView>
    );
  }

  // Guest profile — simplified view without Firebase-dependent features
  if (isGuest) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Guest Header */}
          <View className="bg-white dark:bg-neutral-800 px-4 pt-6 pb-8">
            <View className="items-center">
              <Avatar name="Guest Chef" size="xl" />
              <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mt-4">
                Guest Chef
              </Text>
              <Text className="text-neutral-500 dark:text-neutral-400 mt-1">
                Browsing as guest
              </Text>
            </View>
          </View>

          {/* Sign-up prompt */}
          <View className="px-4 py-6">
            <View className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5 items-center" style={profileStyles.card}>
              <Ionicons name="person-add" size={40} color="#6366F1" />
              <Text className="text-lg font-bold text-neutral-800 dark:text-neutral-100 mt-3 text-center">
                Create an account
              </Text>
              <Text className="text-neutral-500 dark:text-neutral-400 text-center mt-2 mb-4">
                Sign up to save recipes, sync across devices, and unlock all features
              </Text>
              <Button title="Sign Up" onPress={() => router.push('/auth/register')} fullWidth />
              <TouchableOpacity onPress={() => router.push('/auth/login')} className="mt-3">
                <Text className="text-indigo-500 font-medium">Already have an account? Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Settings (subset available to guests) */}
          <View className="px-4 py-4">
            <Text className="text-sm font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2 ml-1">
              Settings
            </Text>
            <View className="bg-white dark:bg-neutral-800 rounded-2xl overflow-hidden mb-5" style={profileStyles.card}>
              {([
                { id: 'appearance', icon: 'color-palette', label: 'Appearance', subtitle: 'Theme & display', route: '/settings/appearance', color: '#8B5CF6' },
                { id: 'help', icon: 'help-circle', label: 'Help & Support', route: '/settings/help', color: '#6B7280' },
                { id: 'terms', icon: 'document-text', label: 'Terms of Service', route: '/settings/terms', color: '#6B7280' },
                { id: 'privacy', icon: 'shield', label: 'Privacy Policy', route: '/settings/privacy', color: '#6B7280' },
              ] as ColorMenuItem[]).map((item, idx, arr) => (
                <View key={item.id}>
                  <TouchableOpacity
                    onPress={() => router.push(item.route as any)}
                    className="flex-row items-center py-3.5 px-4"
                    activeOpacity={0.7}
                  >
                    <View
                      className="w-10 h-10 rounded-xl items-center justify-center mr-3.5"
                      style={{ backgroundColor: item.color + '15' }}
                    >
                      <Ionicons name={item.icon} size={20} color={item.color} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
                        {item.label}
                      </Text>
                      {item.subtitle && (
                        <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {item.subtitle}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                  {idx < arr.length - 1 && (
                    <View className="h-px bg-neutral-100 dark:bg-neutral-700 ml-16 mr-4" />
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Exit guest mode */}
          <View className="px-4 mt-2 mb-8">
            <Button
              title="Exit Guest Mode"
              variant="outline"
              onPress={handleSignOut}
              fullWidth
            />
          </View>

          <Text className="center text-neutral-400 dark:text-neutral-500 text-sm mb-2 text-center">
            SousChef v1.0.0
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Profile Header */}
        <View className="bg-white dark:bg-neutral-800 px-4 pt-6 pb-8">
          <View className="items-center">
            <Avatar name={user.displayName} imageUrl={user.photoURL} size="xl" />
            <View className="flex-row items-center mt-4">
              <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mr-2">
                {user.displayName}
              </Text>
              {isSubscribed && <PremiumBadge tier={subscriptionTier} size="small" />}
            </View>
            <Text className="text-neutral-500 dark:text-neutral-400">{user.email}</Text>

            {/* Role badge */}
            {(user.role === 'chef' || user.role === 'admin') && (
              <View className="mt-2 px-3 py-1 rounded-full flex-row items-center" style={{ backgroundColor: colors.accent + '20' }}>
                <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                <Text className="font-medium ml-1 capitalize" style={{ color: colors.accent }}>
                  {user.role}
                </Text>
              </View>
            )}
          </View>

          {/* Stats */}
          <View className="flex-row justify-around mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-700">
            <View className="items-center">
              <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                {myRecipes.length}
              </Text>
              <Text className="text-neutral-500 dark:text-neutral-400">Recipes</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                {user.savedRecipes?.length || 0}
              </Text>
              <Text className="text-neutral-500 dark:text-neutral-400">Saved</Text>
            </View>
          </View>
        </View>

        {/* Subscription Section */}
        <View className="px-4 py-4">
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3">
            Subscription
          </Text>
          <SubscriptionCard
            onUpgradePress={() => setShowPaywall(true)}
            onManagePress={() => router.push('/subscription')}
            showUsage={true}
          />
        </View>

        {/* Settings */}
        <View className="px-4 py-4">
          <Text className="text-sm font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2 ml-1">
            Settings
          </Text>
          <View className="bg-white dark:bg-neutral-800 rounded-2xl overflow-hidden mb-5" style={profileStyles.card}>
            {([
              { id: 'edit-profile', icon: 'person', label: 'Edit Profile', subtitle: 'Name, photo & details', route: '/settings/edit-profile', color: '#6366F1' },
              { id: 'subscription', icon: 'diamond', label: 'Subscription', subtitle: isSubscribed ? 'Manage plan' : 'Upgrade to Premium', route: '/subscription', color: '#F97316' },
              { id: 'dietary', icon: 'leaf', label: 'Dietary Preferences', subtitle: 'Allergies & diet type', route: '/settings/dietary', color: '#10B981' },
              { id: 'notifications', icon: 'notifications', label: 'Notifications', route: '/settings/notifications', color: '#3B82F6' },
              { id: 'appearance', icon: 'color-palette', label: 'Appearance', subtitle: 'Theme & display', route: '/settings/appearance', color: '#8B5CF6' },
              { id: 'voice', icon: 'mic', label: 'Voice Commands', subtitle: 'Hands-free cooking', route: '/settings/voice', color: '#EC4899' },
            ] as ColorMenuItem[]).map((item, idx, arr) => (
              <View key={item.id}>
                <TouchableOpacity
                  onPress={() => router.push(item.route as any)}
                  className="flex-row items-center py-3.5 px-4"
                  activeOpacity={0.7}
                >
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center mr-3.5"
                    style={{ backgroundColor: item.color + '15' }}
                  >
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
                      {item.label}
                    </Text>
                    {item.subtitle && (
                      <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {item.subtitle}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
                {idx < arr.length - 1 && (
                  <View className="h-px bg-neutral-100 dark:bg-neutral-700 ml-16 mr-4" />
                )}
              </View>
            ))}
          </View>

          {/* Admin section */}
          {(user.role === 'admin' || user.role === 'chef') && (
            <>
              <Text className="text-sm font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2 ml-1">
                Chef Tools
              </Text>
              <View className="bg-white dark:bg-neutral-800 rounded-2xl overflow-hidden mb-5" style={profileStyles.card}>
                {([
                  { id: 'add-recipe', icon: 'add-circle', label: 'Add Official Recipe', route: '/admin/add-recipe', color: '#10B981' },
                  { id: 'seed', icon: 'server', label: 'Seed Database', route: '/admin/seed', color: '#6366F1' },
                  { id: 'analytics', icon: 'bar-chart', label: 'Recipe Analytics', route: '/settings/analytics', color: '#3B82F6' },
                  { id: 'ads', icon: 'megaphone', label: 'Manage Sponsored Ads', route: '/admin/manage-ads', color: '#F59E0B' },
                ] as ColorMenuItem[]).map((item, idx, arr) => (
                  <View key={item.id}>
                    <TouchableOpacity
                      onPress={() => router.push(item.route as any)}
                      className="flex-row items-center py-3.5 px-4"
                      activeOpacity={0.7}
                    >
                      <View
                        className="w-10 h-10 rounded-xl items-center justify-center mr-3.5"
                        style={{ backgroundColor: item.color + '15' }}
                      >
                        <Ionicons name={item.icon} size={20} color={item.color} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
                          {item.label}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                    {idx < arr.length - 1 && (
                      <View className="h-px bg-neutral-100 dark:bg-neutral-700 ml-16 mr-4" />
                    )}
                  </View>
                ))}
              </View>
            </>
          )}

          <Text className="text-sm font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2 ml-1">
            Support
          </Text>
          <View className="bg-white dark:bg-neutral-800 rounded-2xl overflow-hidden mb-5" style={profileStyles.card}>
            {([
              { id: 'help', icon: 'help-circle', label: 'Help & Support', route: '/settings/help', color: '#6B7280' },
              { id: 'terms', icon: 'document-text', label: 'Terms of Service', route: '/settings/terms', color: '#6B7280' },
              { id: 'privacy', icon: 'shield', label: 'Privacy Policy', route: '/settings/privacy', color: '#6B7280' },
              { id: 'advertise', icon: 'megaphone', label: 'Advertise on SousChef', route: '/settings/advertise', color: '#6B7280' },
            ] as ColorMenuItem[]).map((item, idx, arr) => (
              <View key={item.id}>
                <TouchableOpacity
                  onPress={() => router.push(item.route as any)}
                  className="flex-row items-center py-3.5 px-4"
                  activeOpacity={0.7}
                >
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center mr-3.5"
                    style={{ backgroundColor: item.color + '15' }}
                  >
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
                      {item.label}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
                {idx < arr.length - 1 && (
                  <View className="h-px bg-neutral-100 dark:bg-neutral-700 ml-16 mr-4" />
                )}
              </View>
            ))}
          </View>

          <Text className="text-sm font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2 ml-1">
            Account
          </Text>
          <View className="bg-white dark:bg-neutral-800 rounded-2xl overflow-hidden" style={profileStyles.card}>
            <TouchableOpacity
              onPress={handleDeleteAccount}
              className="flex-row items-center py-3.5 px-4"
              activeOpacity={0.7}
            >
              <View
                className="w-10 h-10 rounded-xl items-center justify-center mr-3.5"
                style={{ backgroundColor: '#EF444415' }}
              >
                <Ionicons name="trash" size={20} color="#EF4444" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-red-500">Delete Account</Text>
                <Text className="text-sm text-red-400 mt-0.5">Permanently remove all data</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>

          {/* AdMob Banner — hidden for Premium/Pro */}
          {!adFree && (
            <View className="mt-6">
              <AdMobBanner />
            </View>
          )}

          {/* Sign out */}
          <View className="mt-6 mb-8">
            <Button
              title="Sign Out"
              variant="outline"
              onPress={handleSignOut}
              isLoading={isLoading}
              fullWidth
            />
          </View>

          {/* App version */}
          <Text className="center text-neutral-400 dark:text-neutral-500 text-sm mb-2">
            SousChef v1.0.0
          </Text>


        </View>

        {/* My Recipes */}
        {myRecipes.length > 0 && (
          <View className="px-4 pb-6">
            <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-3">
              My Recipes
            </Text>
            {myRecipes.slice(0, 3).map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
                showAuthor={false}
              />
            ))}
            {myRecipes.length > 3 && (
              <TouchableOpacity className="items-center py-3">
                <Text className="font-medium" style={{ color: colors.accent }}>
                  View all {myRecipes.length} recipes
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        requiredTier="premium"
      />
    </SafeAreaView>
  );
}

const profileStyles = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
});

// Legacy — kept for reference
interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  showBorder?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  label,
  onPress,
  showBorder = true,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center px-4 py-4 ${
        showBorder ? 'border-b border-neutral-100 dark:border-neutral-700' : ''
      }`}
      activeOpacity={0.7}
    >
      <View className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-700 items-center justify-center">
        <Ionicons name={icon} size={20} color={"#737373"} />
      </View>
      <Text className="flex-1 ml-3 text-base text-neutral-900 dark:text-neutral-100">{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={"#A3A3A3"} />
    </TouchableOpacity>
  );
};
