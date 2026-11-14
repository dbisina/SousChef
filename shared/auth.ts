export type UserRole = 'user' | 'admin';

/** What anyone may see about a user. */
export interface PublicProfile {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  photoUrl: string | null;
  isChef: boolean;
  /** Paid and checked: shows the badge. */
  isVerifiedChef: boolean;
  /** `house` is an official SousChef account: the app shows a badge. */
  kind: 'person' | 'house';
}

/** The signed-in user's own account. */
export interface Me extends PublicProfile {
  email: string | null;
  emailVerified: boolean;
  role: UserRole;
  /** Which ways of signing in are attached to this account. */
  providers: ('password' | 'google' | 'apple')[];
  createdAt: string;
}

export interface AuthTokens {
  /** Short-lived. Sent as `Authorization: Bearer ...`. */
  accessToken: string;
  accessTokenExpiresAt: string;
  /** Long-lived, single use: every refresh returns a new one. Store in secure storage. */
  refreshToken: string;
}

export interface AuthResponse {
  user: Me;
  tokens: AuthTokens;
}

export interface DeviceInfo {
  /** For the "signed in on" list, e.g. "iPhone 15". */
  name?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  device?: DeviceInfo;
  /** The version of the terms and privacy policy the person accepted. */
  acceptedTermsVersion: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  device?: DeviceInfo;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

export type SocialProvider = 'google' | 'apple';

export interface SocialLoginRequest {
  provider: SocialProvider;
  /** The ID token the provider's sign-in gave the app. */
  idToken: string;
  /** Apple only sends the name the first time; the app passes it along. */
  displayName?: string;
  device?: DeviceInfo;
  acceptedTermsVersion?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface UpdateProfileRequest {
  displayName?: string;
  handle?: string;
  bio?: string;
  photoUrl?: string | null;
  isChef?: boolean;
}

export interface DeleteAccountRequest {
  /** Required when the account has a password. */
  password?: string;
  /** Required when it does not (social sign-in only): the word DELETE. */
  confirm?: 'DELETE';
}

export interface RegisterDeviceRequest {
  pushToken: string;
  platform: 'ios' | 'android';
  appVersion?: string;
}
