import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, doc, setDoc, updateDoc, Timestamp } from '@/lib/firebase';

const PUSH_TOKEN_KEY = '@souschef_push_token';
const NOTIFICATIONS_KEY = '@souschef_notifications';

// ─── Notification channel & default handler ───────────────────────────

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// ─── Types ────────────────────────────────────────────────────────────

export interface NotificationPreferences {
    pushEnabled: boolean;
    pantryExpiry: boolean;
    mealReminders: boolean;
    weeklyDigest: boolean;
    newRecipes: boolean;
    promotions: boolean;
}

export const defaultPreferences: NotificationPreferences = {
    pushEnabled: true,
    pantryExpiry: true,
    mealReminders: true,
    weeklyDigest: false,
    newRecipes: true,
    promotions: false,
};

// ─── Permission & Token Registration ──────────────────────────────────

export const registerForPushNotifications = async (
    userId?: string
): Promise<string | null> => {
    // Only real devices can receive push notifications
    if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return null;
    }

    // Check existing permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Ask for permission if not granted
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('Notification permission not granted');
        return null;
    }

    // Set up Android notification channel
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'SousChef',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF6B35',
            sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('pantry-alerts', {
            name: 'Pantry Alerts',
            description: 'Expiry warnings for pantry items',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('meal-reminders', {
            name: 'Meal Reminders',
            description: 'Reminders for planned meals',
            importance: Notifications.AndroidImportance.DEFAULT,
            sound: 'default',
        });
    }

    // Get the Expo push token
    try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: '26401b62-e685-47ed-aa5b-ec3d8a4e04cc',
        });
        const token = tokenData.data;

        // Store locally
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

        // Store in Firestore under user doc
        if (userId) {
            await savePushTokenToFirestore(userId, token);
        }

        console.log('Push token registered:', token);
        return token;
    } catch (error) {
        console.error('Error getting push token:', error);
        return null;
    }
};

// Save push token to Firestore for server-side notifications
const savePushTokenToFirestore = async (
    userId: string,
    token: string
): Promise<void> => {
    try {
        await updateDoc(doc(db, 'users', userId), {
            pushToken: token,
            pushTokenUpdatedAt: Timestamp.now(),
            devicePlatform: Platform.OS,
        });
    } catch (error) {
        // If doc doesn't exist yet, try setDoc with merge
        try {
            await setDoc(
                doc(db, 'users', userId),
                {
                    pushToken: token,
                    pushTokenUpdatedAt: Timestamp.now(),
                    devicePlatform: Platform.OS,
                },
                { merge: true }
            );
        } catch (e) {
            console.error('Error saving push token:', e);
        }
    }
};

// ─── Notification Preferences ─────────────────────────────────────────

export const getNotificationPreferences =
    async (): Promise<NotificationPreferences> => {
        try {
            const stored = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
            if (stored) return JSON.parse(stored);
            return defaultPreferences;
        } catch {
            return defaultPreferences;
        }
    };

export const saveNotificationPreferences = async (
    prefs: NotificationPreferences
): Promise<void> => {
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(prefs));

    // If push disabled, cancel all scheduled notifications
    if (!prefs.pushEnabled) {
        await cancelAllScheduledNotifications();
    }
};

// ─── Local / Scheduled Notifications ──────────────────────────────────

/** Schedule a pantry expiry alert */
export const schedulePantryExpiryAlert = async (
    itemName: string,
    daysUntilExpiry: number
): Promise<string | null> => {
    const prefs = await getNotificationPreferences();
    if (!prefs.pushEnabled || !prefs.pantryExpiry) return null;

    // Schedule for morning of the expiry-warning day
    const triggerSeconds = Math.max(daysUntilExpiry * 86400 - 86400, 60); // 1 day before expiry, min 60s

    const id = await Notifications.scheduleNotificationAsync({
        content: {
            title: '🥕 Pantry Alert',
            body: `${itemName} expires ${daysUntilExpiry <= 1 ? 'today' : `in ${daysUntilExpiry} days`}! Use it before it goes to waste.`,
            data: { type: 'pantry_expiry', itemName },
            sound: 'default',
            ...(Platform.OS === 'android' && { channelId: 'pantry-alerts' }),
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: triggerSeconds,
        },
    });
    return id;
};

/** Schedule a meal reminder */
export const scheduleMealReminder = async (
    mealName: string,
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
    dayLabel: string
): Promise<string | null> => {
    const prefs = await getNotificationPreferences();
    if (!prefs.pushEnabled || !prefs.mealReminders) return null;

    const mealHours: Record<string, number> = {
        breakfast: 8,
        lunch: 12,
        dinner: 17,
        snack: 15,
    };

    const id = await Notifications.scheduleNotificationAsync({
        content: {
            title: `🍽️ ${mealType.charAt(0).toUpperCase() + mealType.slice(1)} Reminder`,
            body: `Time to start making ${mealName}!`,
            data: { type: 'meal_reminder', mealName, mealType },
            sound: 'default',
            ...(Platform.OS === 'android' && { channelId: 'meal-reminders' }),
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 60, // immediate for demo; in prod, calculate from dayLabel + mealHours
        },
    });
    return id;
};

/** Send an instant local notification (e.g. recipe import complete) */
export const sendLocalNotification = async (
    title: string,
    body: string,
    data?: Record<string, any>
): Promise<void> => {
    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data: data || {},
            sound: 'default',
        },
        trigger: null, // immediate
    });
};

/** Cancel all scheduled notifications */
export const cancelAllScheduledNotifications = async (): Promise<void> => {
    await Notifications.cancelAllScheduledNotificationsAsync();
};

/** Get count of scheduled notifications */
export const getScheduledCount = async (): Promise<number> => {
    const scheduled =
        await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.length;
};

// ─── Badge Management ─────────────────────────────────────────────────

export const setBadgeCount = async (count: number): Promise<void> => {
    await Notifications.setBadgeCountAsync(count);
};

export const clearBadge = async (): Promise<void> => {
    await Notifications.setBadgeCountAsync(0);
};
