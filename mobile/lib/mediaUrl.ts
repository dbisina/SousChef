/**
 * Pictures live in Cloudflare R2 (our file store); Cloudinary sits in front of it as the delivery layer. For an address on one
 * of our media hosts, the phone asks Cloudinary for a resized, compressed copy (WebP/AVIF where the phone can show it) instead of
 * the full-size original, which is much lighter on mobile data. Anything else (a file on the phone, another site's picture, a
 * bundled image) is left exactly as it is, and with no Cloudinary name set nothing changes at all.
 *
 *   EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME   your Cloudinary cloud name (empty = no resizing)
 *   EXPO_PUBLIC_MEDIA_HOSTS             comma-separated hosts of our file store (the R2 public address, an older bucket host);
 *                                       these must also be listed under Cloudinary > Settings > Security > "Allowed fetch domains"
 */

const WIDTHS = [96, 160, 320, 480, 640, 960, 1280];

const cloud = (): string => (process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '').trim();
const mediaHosts = (): string[] =>
  (process.env.EXPO_PUBLIC_MEDIA_HOSTS ?? '')
    .split(',')
    .map((h: string) => h.trim().toLowerCase())
    .filter(Boolean);

/** The smallest standard width that is at least `width` (so the same few sizes are cached and reused). */
export const widthBucket = (width: number): number => WIDTHS.find((w) => w >= width) ?? (WIDTHS[WIDTHS.length - 1] as number);

/** The address to load for a stored picture shown about `width` points wide (on a screen with this pixel density). */
export function deliveryUrl(uri: string, width: number, density = 2): string {
  const name = cloud();
  if (!name || !/^https:\/\//i.test(uri)) return uri;
  let host: string;
  try {
    host = new URL(uri).hostname.toLowerCase();
  } catch {
    return uri;
  }
  if (!mediaHosts().includes(host)) return uri;
  const w = widthBucket(Math.ceil(width * Math.min(2, Math.max(1, density))));
  const remote = uri.includes('?') ? encodeURIComponent(uri) : uri;
  return `https://res.cloudinary.com/${name}/image/fetch/f_auto,q_auto,c_limit,w_${w}/${remote}`;
}

/** An image source with its address swapped for the delivery one; numbers (bundled images) and file addresses pass through. */
export function optimizedSource<T>(source: T, width: number, density?: number): T {
  if (source && typeof source === 'object' && 'uri' in source && typeof (source as { uri?: unknown }).uri === 'string') {
    const uri = (source as { uri: string }).uri;
    const next = deliveryUrl(uri, width, density);
    return next === uri ? source : ({ ...(source as object), uri: next } as T);
  }
  return source;
}
