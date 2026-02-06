import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card } from '@/components/ui';

const NOTIFICATIONS_KEY = '@souschef_notifications';

interface NotificationSettings {
  pushEnabled: boolean;
  pantryExpiry: boolean;
  mealReminders: boolean;
  weeklyDigest: boolean;
  newRecipes: boolean;
  promotions: boolean;
}

const defaultSettings: NotificationSettings = {
  pushEnabled: true,
  pantryExpiry: true,
  mealReminders: true,
  weeklyDigest: false,
  newRecipes: true,
  promotions: false,
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: NotificationSettings) => {
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const toggleSetting = (key: keyof NotificationSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };

    // If turning off push, turn off all other notifications
    if (key === 'pushEnabled' && settings.pushEnabled) {
      Object.keys(newSettings).forEach((k) => {
        newSettings[k as keyof NotificationSettings] = false;
      });
    }

    // If turning on any notification, ensure push is enabled
    if (key !== 'pushEnabled' && !settings.pushEnabled && !settings[key]) {
      newSettings.pushEnabled = true;
    }

    saveSettings(newSettings);
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-100 bg-white">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#404040" />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-neutral-900 ml-2">
          Notifications
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Master toggle */}
          <Card className="mb-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-full bg-primary-100 items-center justify-center">
                  <Ionicons name="notifications" size={20} color="#FF6B35" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-semibold text-neutral-900">Push Notifications</Text>
                  <Text className="text-sm text-neutral-500">Enable all notifications</Text>
                </View>
              </View>
              <Switch
                value={settings.pushEnabled}
                onValueChange={() => toggleSetting('pushEnabled')}
                trackColor={{ false: '#D4D4D4', true: '#FDBA74' }}
                thumbColor={settings.pushEnabled ? '#FF6B35' : '#F5F5F5'}
              />
            </View>
          </Card>

          {/* Cooking & Pantry */}
          <Text className="text-sm font-medium text-neutral-500 uppercase mb-3">
            Cooking & Pantry
          </Text>
          <Card padding="none" className="mb-6">
            <NotificationToggle
              icon="warning-outline"
              iconColor="#D97706"
              title="Pantry Expiry Alerts"
              description="Get notified when items are expiring"
              value={settings.pantryExpiry}
              onToggle={() => toggleSetting('pantryExpiry')}
              disabled={!settings.pushEnabled}
            />
            <NotificationToggle
              icon="alarm-outline"
              iconColor="#3B82F6"
              title="Meal Reminders"
              description="Reminders for planned meals"
              value={settings.mealReminders}
              onToggle={() => toggleSetting('mealReminders')}
              disabled={!settings.pushEnabled}
              showBorder={false}
            />
          </Card>

          {/* Content */}
          <Text className="text-sm font-medium text-neutral-500 uppercase mb-3">
            Content & Updates
          </Text>
          <Card padding="none" className="mb-6">
            <NotificationToggle
              icon="newspaper-outline"
              iconColor="#22C55E"
              title="Weekly Digest"
              description="Summary of your cooking activity"
              value={settings.weeklyDigest}
              onToggle={() => toggleSetting('weeklyDigest')}
              disabled={!settings.pushEnabled}
            />
            <NotificationToggle
              icon="restaurant-outline"
              iconColor="#FF6B35"
              title="New Recipes"
              description="Get notified about new recipes"
              value={settings.newRecipes}
              onToggle={() => toggleSetting('newRecipes')}
              disabled={!settings.pushEnabled}
              showBorder={false}
            />
          </Card>

          {/* Marketing */}
          <Text className="text-sm font-medium text-neutral-500 uppercase mb-3">
            Marketing
          </Text>
          <Card padding="none">
            <NotificationToggle
              icon="megaphone-outline"
              iconColor="#8B5CF6"
              title="Promotions & Offers"
              description="Special deals and discounts"
              value={settings.promotions}
              onToggle={() => toggleSetting('promotions')}
              disabled={!settings.pushEnabled}
              showBorder={false}
            />
          </Card>
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
      showBorder ? 'border-b border-neutral-100' : ''
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
        <Text className="font-medium text-neutral-900">{title}</Text>
        <Text className="text-sm text-neutral-500">{description}</Text>
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
