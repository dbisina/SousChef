import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useThemeColors } from '@/stores/themeStore';
import { Card } from '@/components/ui';
import {
  NotificationPreferences,
  defaultPreferences,
  getNotificationPreferences,
  saveNotificationPreferences,
  registerForPushNotifications,
  getScheduledCount,
  cancelAllScheduledNotifications,
} from '@/services/notificationService';
import { useAuthStore } from '@/stores/authStore';

export default function NotificationsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { user } = useAuthStore();
  const [settings, setSettings] = useState<NotificationPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
  const [scheduledCount, setScheduledCount] = useState(0);

  useEffect(() => {
    loadSettings();
    checkPermission();
    loadScheduledCount();
  }, []);

  const loadSettings = async () => {
    try {
      const prefs = await getNotificationPreferences();
      setSettings(prefs);
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkPermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setPermissionStatus(status);
  };

  const loadScheduledCount = async () => {
    const count = await getScheduledCount();
    setScheduledCount(count);
  };

  const handleToggle = async (key: keyof NotificationPreferences) => {
    const newSettings = { ...settings };

    if (key === 'pushEnabled') {
      if (settings.pushEnabled) {
        // Turning off — disable everything
        Object.keys(newSettings).forEach((k) => {
          newSettings[k as keyof NotificationPreferences] = false;
        });
      } else {
        // Turning on — request permission first
        if (permissionStatus !== 'granted') {
          const token = await registerForPushNotifications(user?.id);
          if (!token) {
            Alert.alert(
              'Permission Required',
              'Please enable notifications in your device settings to receive alerts.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => {
                    if (Platform.OS === 'ios') {
                      Linking.openURL('app-settings:');
                    } else {
                      Linking.openSettings();
                    }
                  },
                },
              ]
            );
            return;
          }
          setPermissionStatus('granted');
        }
        newSettings.pushEnabled = true;
      }
    } else {
      newSettings[key] = !settings[key];
      // If enabling any notification, ensure push is on
      if (!settings[key] && !settings.pushEnabled) {
        const token = await registerForPushNotifications(user?.id);
        if (!token) {
          Alert.alert('Permission Required', 'Enable push notifications first.');
          return;
        }
        setPermissionStatus('granted');
        newSettings.pushEnabled = true;
      }
    }

    await saveNotificationPreferences(newSettings);
    setSettings(newSettings);
    loadScheduledCount();
  };

  const handleClearAll = async () => {
    Alert.alert(
      'Clear Notifications',
      `Cancel all ${scheduledCount} scheduled notifications?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await cancelAllScheduledNotifications();
            setScheduledCount(0);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 bg-white dark:bg-neutral-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color={colors.icon} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-neutral-900 dark:text-neutral-50 ml-2">
          Notifications
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Permission status banner */}
          {permissionStatus !== 'granted' && (
            <View className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-2xl p-4 mb-4 flex-row items-center">
              <Ionicons name="warning-outline" size={20} color="#D97706" />
              <Text className="flex-1 text-amber-800 dark:text-amber-200 ml-3 text-sm">
                Notifications are not enabled. Toggle below to grant permission.
              </Text>
            </View>
          )}

          {/* Master toggle */}
          <Card className="mb-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent + '20' }}>
                  <Ionicons name="notifications" size={20} color={colors.accent} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-semibold text-neutral-900 dark:text-neutral-100">Push Notifications</Text>
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                    {permissionStatus === 'granted' ? 'Enabled' : 'Tap to enable'}
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.pushEnabled}
                onValueChange={() => handleToggle('pushEnabled')}
                trackColor={{ false: '#D4D4D4', true: colors.accent + '80' }}
                thumbColor={settings.pushEnabled ? colors.accent : '#F5F5F5'}
              />
            </View>
          </Card>

          {/* Cooking & Pantry */}
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3">
            Cooking & Pantry
          </Text>
          <Card padding="none" className="mb-6">
            <NotificationToggle
              icon="warning-outline"
              iconColor="#D97706"
              title="Pantry Expiry Alerts"
              description="Get notified when items are expiring"
              value={settings.pantryExpiry}
              onToggle={() => handleToggle('pantryExpiry')}
              disabled={!settings.pushEnabled}
            />
            <NotificationToggle
              icon="alarm-outline"
              iconColor="#3B82F6"
              title="Meal Reminders"
              description="Reminders for planned meals"
              value={settings.mealReminders}
              onToggle={() => handleToggle('mealReminders')}
              disabled={!settings.pushEnabled}
              showBorder={false}
            />
          </Card>

          {/* Content */}
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3">
            Content & Updates
          </Text>
          <Card padding="none" className="mb-6">
            <NotificationToggle
              icon="newspaper-outline"
              iconColor="#22C55E"
              title="Weekly Digest"
              description="Summary of your cooking activity"
              value={settings.weeklyDigest}
              onToggle={() => handleToggle('weeklyDigest')}
              disabled={!settings.pushEnabled}
            />
            <NotificationToggle
              icon="restaurant-outline"
              iconColor="#FF6B35"
              title="New Recipes"
              description="Get notified about new recipes"
              value={settings.newRecipes}
              onToggle={() => handleToggle('newRecipes')}
              disabled={!settings.pushEnabled}
              showBorder={false}
            />
          </Card>

          {/* Marketing */}
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3">
            Marketing
          </Text>
          <Card padding="none" className="mb-4">
            <NotificationToggle
              icon="megaphone-outline"
              iconColor="#8B5CF6"
              title="Promotions & Offers"
              description="Special deals and discounts"
              value={settings.promotions}
              onToggle={() => handleToggle('promotions')}
              disabled={!settings.pushEnabled}
              showBorder={false}
            />
          </Card>

          {/* Scheduled notification count */}
          {scheduledCount > 0 && (
            <Card className="mb-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                  <Text className="text-neutral-600 dark:text-neutral-400 ml-2">
                    {scheduledCount} scheduled notification{scheduledCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleClearAll}>
                  <Text className="text-red-500 font-medium">Clear All</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface NotificationToggleProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  description: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
  showBorder?: boolean;
}

const NotificationToggle: React.FC<NotificationToggleProps> = ({
  icon,
  iconColor,
  title,
  description,
  value,
  onToggle,
  disabled,
  showBorder = true,
}) => (
  <View
    className={`flex-row items-center justify-between px-4 py-4 ${
      showBorder ? 'border-b border-neutral-100 dark:border-neutral-700' : ''
    }`}
    style={{ opacity: disabled ? 0.5 : 1 }}
  >
    <View className="flex-row items-center flex-1">
      <View
        className="w-10 h-10 rounded-full items-center justify-center"
        style={{ backgroundColor: `${iconColor}15` }}
      >
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="font-medium text-neutral-900 dark:text-neutral-100">{title}</Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">{description}</Text>
      </View>
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      disabled={disabled}
      trackColor={{ false: '#D4D4D4', true: '#FDBA74' }}
      thumbColor={value ? '#FF6B35' : '#F5F5F5'}
    />
  </View>
);
