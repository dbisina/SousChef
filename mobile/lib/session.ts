// Who is signed in, for code that must not import the auth store at load time (the auth store reaches Firebase, which the
// feed and chat stores should not drag in just to exist).
export function currentUserId(): string | null {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useAuthStore } = require('@/stores/authStore') as typeof import('@/stores/authStore');
  return useAuthStore.getState().user?.id ?? null;
}
