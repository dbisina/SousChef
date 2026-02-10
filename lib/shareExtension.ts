/**
 * Native module bridge for reading shared URLs from the iOS Share Extension.
 * 
 * The Share Extension writes URLs to App Group UserDefaults.
 * This module reads them from the React Native side, enabling
 * the full share sheet workflow:
 *   User shares URL → iOS Share Sheet → SousChef Share Extension → Main App
 */

import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHARED_URL_KEY = '@souschef_shared_url';
const APP_GROUP = 'group.com.lyon98.souschef';

/**
 * Check for URLs shared via the iOS Share Extension (App Group UserDefaults).
 * Falls back to Linking API for URL scheme-based sharing.
 */
export async function getSharedURL(): Promise<string | null> {
    try {
        // First, check if we got a URL via the custom URL scheme (souschef://share?url=...)
        const initialURL = await Linking.getInitialURL();
        if (initialURL) {
            const parsed = parseShareURL(initialURL);
            if (parsed) return parsed;
        }

        // For native App Group access, we'd need a native module.
        // In Expo managed workflow, the share extension writes to URL scheme,
        // which we handle via Linking. This is the primary path.

        // Check AsyncStorage fallback (for when share extension saves there)
        const stored = await AsyncStorage.getItem(SHARED_URL_KEY);
        if (stored) {
            await AsyncStorage.removeItem(SHARED_URL_KEY);
            return stored;
        }

        return null;
    } catch (error) {
        console.error('[ShareExtensionBridge] Error reading shared URL:', error);
        return null;
    }
}

/**
 * Parse a souschef:// URL scheme to extract the shared URL.
 * Format: souschef://share?url=<encoded_url>
 */
export function parseShareURL(urlString: string): string | null {
    try {
        if (!urlString.startsWith('souschef://share')) return null;

        const url = new URL(urlString);
        const sharedURL = url.searchParams.get('url');
        if (sharedURL) {
            return decodeURIComponent(sharedURL);
        }

        // fallback: try to extract from the raw string
        const match = urlString.match(/[?&]url=([^&]+)/);
        if (match) {
            return decodeURIComponent(match[1]);
        }

        return null;
    } catch {
        // If URL parsing fails, try regex
        const match = urlString.match(/[?&]url=([^&]+)/);
        if (match) {
            return decodeURIComponent(match[1]);
        }
        return null;
    }
}

/**
 * Save a shared URL to local storage (used when the app receives 
 * a share intent while loading and needs to defer processing).
 */
export async function saveSharedURLForLater(url: string): Promise<void> {
    try {
        await AsyncStorage.setItem(SHARED_URL_KEY, url);
    } catch (error) {
        console.error('[ShareExtensionBridge] Error saving shared URL:', error);
    }
}

/**
 * Listen for incoming share URLs via the URL scheme.
 * Returns an unsubscribe function.
 */
export function onShareURL(callback: (url: string) => void): () => void {
    const subscription = Linking.addEventListener('url', (event) => {
        const parsed = parseShareURL(event.url);
        if (parsed) {
            callback(parsed);
        }
    });

    return () => subscription.remove();
}
