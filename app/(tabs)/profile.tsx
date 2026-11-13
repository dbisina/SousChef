import React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useMyRecipes } from '@/hooks/useRecipes';
import { useSubscription } from '@/hooks/useSubscription';
import {
  AdMobBanner,
  FONT,
  Icon,
  ListRow,
  Muted,
  PhotoCard,
  Rows,
  Screen,
  Tag,
  UButton,
  UCard,
  UIconButton,
  Title,
  Body,
  type IconName,
} from '@/components/ui';
import { getTierFeatures } from '@/services/subscriptionService';
import { SAMPLE } from '@/assets/sample';

type SettingsRoute =
  | '/subscription'
  | '/settings/dietary'
  | '/settings/weight-loss'
  | '/settings/notifications'
  | '/settings/voice'
  | '/settings/appearance'
  | '/settings/help'
  | '/settings/advertise'
  | '/settings/terms'
  | '/admin/add-recipe'
  | '/admin/manage-ads'
  | '/settings/analytics'
  | '/admin/seed';

interface MenuItem {
  id: string;
  icon: IconName;
  label: string;
  subtitle?: string;
  route: SettingsRoute;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, signOut, isLoading, isGuest } = useAuthStore();

  // Only load user-specific data for authenticated (non-guest) users
  const { recipes: myRecipes } = useMyRecipes();
  const { subscriptionTier, isSubscribed, tierName } = useSubscription();
  const adFree = isGuest ? false : getTierFeatures(subscriptionTier).adFree;

  const handleSignOut = () => {
    if (isGuest) {
      // Guest users just reset state and go to login
      useAuthStore.getState().setUser(null);
      router.replace('/auth/login');
      return;
    }
    Alert.alert(
      t('account.profile.signOut', 'Sign Out'),
      t('account.profile.signOutConfirm', 'Are you sure you want to sign out?'),
      [
        { text: t('account.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('account.profile.signOut', 'Sign Out'),
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center" style={{ gap: 16, paddingHorizontal: 20 }}>
          <Body center>{t('account.profile.pleaseSignIn', 'Please sign in to view your profile')}</Body>
          <UButton size="sm" label={t('account.profile.signIn', 'Sign In')} onPress={() => router.push('/auth/login')} />
        </View>
      </Screen>
    );
  }

  const isChef = user.role === 'chef' || user.role === 'admin';

  const guestItems: MenuItem[] = [
    { id: 'appearance', icon: 'moon', label: t('account.profile.appearance', 'Appearance'), route: '/settings/appearance' },
    { id: 'help', icon: 'help', label: t('account.profile.help', 'Help center'), route: '/settings/help' },
    { id: 'terms', icon: 'book', label: t('account.profile.legal', 'Terms and privacy'), route: '/settings/terms' },
  ];

  const memberItems: MenuItem[] = [
    {
      id: 'subscription',
      icon: 'award',
      label: isSubscribed ? t('account.profile.subscription', 'Subscription') : t('account.profile.upgrade', 'Upgrade to Pro'),
      subtitle: isSubscribed ? t('account.profile.managePlan', 'Manage plan') : t('account.profile.upgradeBody', 'Unlock every feature'),
      route: '/subscription',
    },
    { id: 'dietary', icon: 'leaf', label: t('account.profile.dietary', 'Dietary Preferences'), route: '/settings/dietary' },
    { id: 'weight', icon: 'flame', label: t('account.profile.weight', 'Weight Goals'), route: '/settings/weight-loss' },
    { id: 'notifications', icon: 'bell', label: t('account.profile.notifications', 'Notifications'), route: '/settings/notifications' },
    { id: 'voice', icon: 'mic', label: t('account.profile.voice', 'Voice Commands'), route: '/settings/voice' },
    { id: 'appearance', icon: 'moon', label: t('account.profile.appearance', 'Appearance'), route: '/settings/appearance' },
    { id: 'help', icon: 'help', label: t('account.profile.help', 'Help center'), route: '/settings/help' },
    { id: 'advertise', icon: 'store', label: t('account.profile.advertise', 'Advertise on SousChef'), route: '/settings/advertise' },
    { id: 'terms', icon: 'book', label: t('account.profile.legal', 'Terms and privacy'), route: '/settings/terms' },
  ];

  const chefItems: MenuItem[] = [
    { id: 'add-recipe', icon: 'plus', label: t('account.profile.addOfficial', 'Add official recipe'), route: '/admin/add-recipe' },
    { id: 'ads', icon: 'bag', label: t('account.profile.manageAds', 'Manage ads'), route: '/admin/manage-ads' },
    { id: 'analytics', icon: 'trend', label: t('account.profile.analytics', 'Recipe analytics'), route: '/settings/analytics' },
    { id: 'seed', icon: 'grid', label: t('account.profile.seed', 'Database seeder'), route: '/admin/seed' },
  ];

  const items = isGuest ? guestItems : [...memberItems, ...(isChef ? chefItems : [])];

  const renderRow = (item: MenuItem) => {
    const accent = item.id === 'subscription' && !isSubscribed;
    return (
      <ListRow
        key={item.id}
        title={item.label}
        subtitle={item.subtitle}
        icon={accent ? undefined : item.icon}
        leading={
          accent ? (
            <View className="items-center justify-center bg-accent" style={{ width: 44, height: 44, borderRadius: 22 }}>
              <Icon name={item.icon} color="accent-ink" />
            </View>
          ) : undefined
        }
        onPress={() => router.push(item.route)}
      />
    );
  };

  const name = isGuest ? t('account.profile.guestChef', 'Guest Chef') : user.displayName;
  const photo = !isGuest && user.photoURL ? { uri: user.photoURL } : SAMPLE.chef;
  const stats = isGuest
    ? t('account.profile.browsingAsGuest', 'Browsing as guest')
    : t('account.profile.stats', '{{recipes}} recipes · {{saved}} saved', {
        recipes: myRecipes.length,
        saved: user.savedRecipes?.length || 0,
      });
  const planLabel = isGuest
    ? t('account.profile.guest', 'Guest')
    : isSubscribed
      ? tierName
      : t('account.profile.freePlan', 'Free plan');
  const topInset = Math.max(insets.top, 20) + 14;

  return (
    <Screen bare>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <PhotoCard
          source={photo}
          height={300}
          radius={0}
          fade="both"
          style={{ borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }}
          accessibilityLabel={t('account.profile.photoLabel', 'Your profile photo')}
        >
          <View
            className="flex-row items-center justify-between"
            style={{ position: 'absolute', top: topInset, left: 20, right: 20, zIndex: 2 }}
          >
            <Tag tone="glassDark" large label={t('account.profile.title', 'Profile')} />
            {!isGuest ? (
              <UIconButton
                icon="edit"
                tone="glassDark"
                label={t('account.profile.edit', 'Edit profile')}
                onPress={() => router.push('/settings/edit-profile')}
              />
            ) : null}
          </View>
          <View
            className="flex-row items-end justify-between"
            style={{ position: 'absolute', left: 22, right: 22, bottom: 22, gap: 12, zIndex: 2 }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text
                numberOfLines={1}
                className="text-paper"
                style={{ fontFamily: FONT.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.56 }}
              >
                {name}
              </Text>
              <Text className="text-paper" style={{ fontFamily: FONT.sans, fontSize: 12, opacity: 0.82 }}>
                {stats}
              </Text>
            </View>
            <Tag tone="glass" large label={planLabel} />
          </View>
        </PhotoCard>

        <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 16 }}>
          {isGuest ? (
            <UCard style={{ gap: 10 }}>
              <Title>{t('account.profile.createAccount', 'Create an account')}</Title>
              <Muted>
                {t('account.profile.createAccountBody', 'Sign up to save recipes, sync across devices, and unlock all features')}
              </Muted>
              <UButton label={t('account.profile.signUp', 'Sign Up')} onPress={() => router.push('/auth/register')} />
              <UButton
                variant="ghost"
                label={t('account.profile.haveAccount', 'Already have an account? Sign In')}
                onPress={() => router.push('/auth/login')}
              />
            </UCard>
          ) : null}

          <Rows>{items.map(renderRow)}</Rows>

          {/* Banner ad hidden for ad-free tiers */}
          {!adFree ? <AdMobBanner /> : null}

          <UButton
            variant="ghost"
            label={isGuest ? t('account.profile.exitGuest', 'Exit Guest Mode') : t('account.profile.signOut', 'Sign Out')}
            loading={isLoading}
            onPress={handleSignOut}
          />

          <Muted small center>
            SousChef v1.0.0
          </Muted>
        </View>
      </ScrollView>
    </Screen>
  );
}
