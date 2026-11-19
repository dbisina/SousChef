/**
 * Where people reach us. These come from the build settings (EXPO_PUBLIC_SUPPORT_EMAIL, EXPO_PUBLIC_DEVELOPER_EMAIL,
 * EXPO_PUBLIC_SITE_URL) so the app never points at an address we do not own. When one is not set, the screen that would use it
 * hides that row instead of sending people somewhere wrong.
 */
const clean = (v: string | undefined): string => (v ?? '').trim();

export const SUPPORT_EMAIL = clean(process.env.EXPO_PUBLIC_SUPPORT_EMAIL);
export const DEVELOPER_EMAIL = clean(process.env.EXPO_PUBLIC_DEVELOPER_EMAIL) || SUPPORT_EMAIL;
export const SITE_URL = clean(process.env.EXPO_PUBLIC_SITE_URL);
