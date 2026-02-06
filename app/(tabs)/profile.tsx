import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useMyRecipes } from '@/hooks/useRecipes';
import { useSubscription } from '@/hooks/useSubscription';
import { Avatar, Card, Button } from '@/components/ui';
import { RecipeCard } from '@/components/recipe';
import { PremiumBadge, SubscriptionCard, Paywall } from '@/components/subscription';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, isLoading } = useAuthStore();
  const { recipes: myRecipes, isLoading: recipesLoading } = useMyRecipes();
  const { subscriptionTier, isSubscribed } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);

  const handleSignOut = () => {
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
      <SafeAreaView className="flex-1 bg-neutral-50 items-center justify-center px-4">
        <Text className="text-lg text-neutral-600 mb-4">Please sign in to view your profile</Text>
        <Button title="Sign In" onPress={() => router.push('/auth/login')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Profile Header */}
        <View className="bg-white px-4 pt-6 pb-8">
          <View className="items-center">
            <Avatar name={user.displayName} imageUrl={user.photoURL} size="xl" />
            <View className="flex-row items-center mt-4">
              <Text className="text-2xl font-bold text-neutral-900 mr-2">
                {user.displayName}
              </Text>
              {isSubscribed && <PremiumBadge tier={subscriptionTier} size="small" />}
            </View>
            <Text className="text-neutral-500">{user.email}</Text>

            {/* Role badge */}
            {(user.role === 'chef' || user.role === 'admin') && (
              <View className="mt-2 px-3 py-1 bg-primary-100 rounded-full flex-row items-center">
                <Ionicons name="checkmark-circle" size={16} color="#FF6B35" />
                <Text className="text-primary-600 font-medium ml-1 capitalize">
                  {user.role}
                </Text>
              </View>
            )}
          </View>

          {/* Stats */}
          <View className="flex-row justify-around mt-6 pt-6 border-t border-neutral-100">
            <View className="items-center">
              <Text className="text-2xl font-bold text-neutral-900">
                {myRecipes.length}
              </Text>
              <Text className="text-neutral-500">Recipes</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-neutral-900">
                {user.savedRecipes?.length || 0}
              </Text>
              <Text className="text-neutral-500">Saved</Text>
            </View>
          </View>
        </View>

        {/* Subscription Section */}
        <View className="px-4 py-4">
          <Text className="text-sm font-medium text-neutral-500 uppercase mb-3">
            Subscription
          </Text>
          <SubscriptionCard
            onUpgradePress={() => setShowPaywall(true)}
            onManagePress={() => router.push('/subscription')}
            showUsage={true}
          />
        </View>

        {/* Menu items */}
        <View className="px-4 py-4">
          <Text className="text-sm font-medium text-neutral-500 uppercase mb-3">
            Settings
          </Text>

          <Card padding="none" className="overflow-hidden">
            <MenuItem
              icon="create-outline"
              label="Create Recipe"
              onPress={() => router.push('/(tabs)/upload')}
            />
            <MenuItem
              icon="person-outline"
              label="Edit Profile"
              onPress={() => router.push('/settings/edit-profile')}
            />
            <MenuItem
              icon="star-outline"
              label="Subscription"
              onPress={() => router.push('/subscription')}
            />
            <MenuItem
              icon="notifications-outline"
              label="Notifications"
              onPress={() => router.push('/settings/notifications')}
            />
            <MenuItem
              icon="heart-outline"
              label="Dietary Preferences"
              onPress={() => router.push('/settings/dietary')}
            />
            <MenuItem
              icon="color-palette-outline"
              label="Appearance"
              onPress={() => router.push('/settings/appearance')}
            />
          </Card>

          {/* Admin section */}
          {(user.role === 'admin' || user.role === 'chef') && (
            <>
              <Text className="text-sm font-medium text-neutral-500 uppercase mb-3 mt-6">
                Chef Tools
              </Text>
              <Card padding="none" className="overflow-hidden">
                <MenuItem
                  icon="add-circle-outline"
                  label="Add Official Recipe"
                  onPress={() => router.push('/admin/add-recipe')}
                />
                <MenuItem
                  icon="server-outline"
                  label="Seed Database"
                  onPress={() => router.push('/admin/seed')}
                />
                <MenuItem
                  icon="stats-chart-outline"
                  label="Recipe Analytics"
                  onPress={() => router.push('/settings/analytics')}
                />
              </Card>
            </>
          )}

          <Text className="text-sm font-medium text-neutral-500 uppercase mb-3 mt-6">
            Support
          </Text>

          <Card padding="none" className="overflow-hidden">
            <MenuItem
              icon="help-circle-outline"
              label="Help Center"
              onPress={() => router.push('/settings/help')}
            />
            <MenuItem
              icon="document-text-outline"
              label="Terms of Service"
              onPress={() => router.push('/settings/terms')}
            />
            <MenuItem
              icon="shield-outline"
              label="Privacy Policy"
              onPress={() => router.push('/settings/privacy')}
            />
          </Card>

          <Text className="text-sm font-medium text-neutral-500 uppercase mb-3 mt-6">
            Account
          </Text>

          <Card padding="none" className="overflow-hidden">
            <TouchableOpacity
              onPress={handleDeleteAccount}
              className="flex-row items-center px-4 py-4"
              activeOpacity={0.7}
            >
              <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center">
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </View>
              <Text className="flex-1 ml-3 text-base text-red-600">Delete Account</Text>
              <Ionicons name="chevron-forward" size={20} color="#EF4444" />
            </TouchableOpacity>
          </Card>

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
          <Text className="text-center text-neutral-400 text-sm mb-4">
            SousChef v1.0.0
          </Text>
        </View>

        {/* My Recipes */}
        {myRecipes.length > 0 && (
          <View className="px-4 pb-6">
            <Text className="text-lg font-bold text-neutral-900 mb-3">
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
                <Text className="text-primary-500 font-medium">
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
        showBorder ? 'border-b border-neutral-100' : ''
      }`}
      activeOpacity={0.7}
    >
      <View className="w-10 h-10 rounded-full bg-neutral-100 items-center justify-center">
        <Ionicons name={icon} size={20} color="#404040" />
      </View>
      <Text className="flex-1 ml-3 text-base text-neutral-900">{label}</Text>
      <Ionicons name="chevron-forward" size={20} color="#A3A3A3" />
    </TouchableOpacity>
  );
};
