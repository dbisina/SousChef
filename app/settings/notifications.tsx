import React, { useState, useEffect } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import {
  FONT,
  Muted,
  Rows,
  Screen,
  SectionLabel,
  TopBar,
  UCard,
  USwitch,
  UButton,
} from '@/components/ui';
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
import { showInfoToast, showWarningToast } from '@/stores/toastStore';

export default function NotificationsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [settings, setSettings] = useState<NotificationPreferences>(defaultPreferences);
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
            showWarningToast(
              t('account.notif.enableToast', "We'd love to send you helpful cooking reminders. Please enable notifications in your device settings?"),
              t('account.notif.stayInLoop', 'Stay in the loop!')
            );
            Alert.alert(
              t('account.notif.enableTitle', 'Enable Notifications'),
              t('account.notif.enableBody', 'To receive pantry alerts and meal reminders, please enable notifications in your device settings.'),
              [
                { text: t('account.notif.notNow', 'Not Now'), style: 'cancel' },
                {
                  text: t('account.notif.openSettings', 'Open Settings'),
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
          showInfoToast(
            t('account.notif.pushFirst', "Let's get those notifications working! Please enable push notifications first."),
            t('account.notif.almostThere', 'Almost There')
          );
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
      t('account.notif.clearTitle', 'Clear Reminders?'),
      t(
        'account.notif.clearBody',
        "Are you sure you want to cancel all {{n}} cooking reminders? You'll have to set them up again later if you change your mind!",
        { n: scheduledCount }
      ),
      [
        { text: t('account.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('account.notif.clearAll', 'Clear All'),
          style: 'destructive',
          onPress: async () => {
            await cancelAllScheduledNotifications();
            setScheduledCount(0);
          },
        },
      ]
    );
  };

  const off = !settings.pushEnabled;

  return (
    <Screen bare>
      <TopBar variant="compact" title={t('account.notif.title', 'Notifications')} onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}>
        {permissionStatus === 'denied' ? (
          <UCard>
            <Muted small>
              {t('account.notif.notEnabled', 'Notifications are not enabled. Toggle below to grant permission.')}
            </Muted>
          </UCard>
        ) : null}

        <UCard tone="black" style={{ borderRadius: 26, paddingVertical: 16, paddingHorizontal: 18 }}>
          <View className="flex-row items-center" style={{ gap: 14 }}>
            <View className="flex-1" style={{ gap: 2 }}>
              <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
                {t('account.notif.push', 'Push Notifications')}
              </Text>
              <Muted small>
                {settings.pushEnabled
                  ?t('account.notif.pushBody', 'Allow SousChef to send alerts')
                  : t('account.notif.tapToEnable', 'Tap to enable')}
              </Muted>
            </View>
            <USwitch
              label={t('account.notif.push', 'Push Notifications')}
              value={settings.pushEnabled}
              onValueChange={() => handleToggle('pushEnabled')}
            />
          </View>
        </UCard>

        <SectionLabel style={{ marginTop: 8 }}>{t('account.notif.cooking', 'Cooking & pantry')}</SectionLabel>
        <Rows>
          <ToggleRow
            title={t('account.notif.pantryExpiry', 'Pantry Expiry Alerts')}
            description={t('account.notif.pantryExpiryBody', 'When items are about to expire')}
            value={settings.pantryExpiry}
            onToggle={() => handleToggle('pantryExpiry')}
            disabled={off}
          />
          <ToggleRow
            title={t('account.notif.mealReminders', 'Meal Reminders')}
            description={t('account.notif.mealRemindersBody', 'Reminders for planned meals')}
            value={settings.mealReminders}
            onToggle={() => handleToggle('mealReminders')}
            disabled={off}
          />
        </Rows>

        <SectionLabel style={{ marginTop: 8 }}>{t('account.notif.content', 'Content')}</SectionLabel>
        <Rows>
          <ToggleRow
            title={t('account.notif.weekly', 'Weekly Digest')}
            description={t('account.notif.weeklyBody', 'Summary of your cooking')}
            value={settings.weeklyDigest}
            onToggle={() => handleToggle('weeklyDigest')}
            disabled={off}
          />
          <ToggleRow
            title={t('account.notif.newRecipes', 'New Recipes')}
            description={t('account.notif.newRecipesBody', 'From chefs you follow')}
            value={settings.newRecipes}
            onToggle={() => handleToggle('newRecipes')}
            disabled={off}
          />
          <ToggleRow
            title={t('account.notif.promotions', 'Promotions & Offers')}
            description={t('account.notif.promotionsBody', 'Deals and discounts')}
            value={settings.promotions}
            onToggle={() => handleToggle('promotions')}
            disabled={off}
          />
        </Rows>

        {scheduledCount > 0 ? (
          <UCard>
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <View className="flex-1">
                <Muted>
                  {scheduledCount === 1
                    ? t('account.notif.scheduledOne', '1 scheduled notification')
                    : t('account.notif.scheduledMany', '{{n}} scheduled notifications', { n: scheduledCount })}
                </Muted>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={handleClearAll}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text className="text-tag-r-fg" style={{ fontFamily: FONT.sansMedium, fontSize: 13 }}>
                  {t('account.notif.clearAll', 'Clear All')}
                </Text>
              </Pressable>
            </View>
          </UCard>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

interface ToggleRowProps {
  title: string;
  description: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ title, description, value, onToggle, disabled }) => (
  <View className="flex-row items-center" style={{ minHeight: 64, gap: 14, opacity: disabled ? 0.5 : 1 }}>
    <View className="flex-1" style={{ gap: 2 }}>
      <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
        {title}
      </Text>
      <Muted small>{description}</Muted>
    </View>
    <USwitch label={title} value={value} onValueChange={onToggle} disabled={disabled} />
  </View>
);
