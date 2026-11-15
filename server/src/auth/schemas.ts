import { z } from 'zod';
import type {
  DeleteAccountRequest,
  ForgotPasswordRequest,
  LoginRequest,
  LogoutRequest,
  RefreshRequest,
  RegisterDeviceRequest,
  RegisterRequest,
  ResetPasswordRequest,
  SocialLoginRequest,
  UpdateProfileRequest,
} from '@shared';
import { errors } from '../errors';

// Each schema is declared against the shared type, so changing the type without the validator fails the build.

const email = z.string().trim().max(254).pipe(z.email());
const password = z.string().min(8, 'Use at least 8 characters').max(128, 'Use at most 128 characters');
const displayName = z.string().trim().min(1, 'Enter a name').max(50);
const device = z.object({ name: z.string().trim().max(80).optional() });
const token = z.string().min(20).max(200);

export const handleSchema = z
  .string()
  .regex(/^[a-z0-9_]{3,20}$/, 'Use 3 to 20 lowercase letters, numbers or underscores');

export const registerSchema = z.object({
  email,
  password,
  displayName,
  device: device.optional(),
  acceptedTermsVersion: z.string().min(1).max(40),
}) satisfies z.ZodType<RegisterRequest>;

export const loginSchema = z.object({
  email,
  // Not length checked: a wrong password is a wrong password, not a validation problem.
  password: z.string().min(1).max(128),
  device: device.optional(),
}) satisfies z.ZodType<LoginRequest>;

export const refreshSchema = z.object({ refreshToken: token }) satisfies z.ZodType<RefreshRequest>;
export const logoutSchema = z.object({ refreshToken: token }) satisfies z.ZodType<LogoutRequest>;

export const socialSchema = z.object({
  provider: z.enum(['google', 'apple', 'firebase']),
  idToken: z.string().min(20).max(4000),
  displayName: displayName.optional(),
  device: device.optional(),
  acceptedTermsVersion: z.string().min(1).max(40).optional(),
}) satisfies z.ZodType<SocialLoginRequest>;

export const forgotSchema = z.object({ email }) satisfies z.ZodType<ForgotPasswordRequest>;
export const resetSchema = z.object({ token, password }) satisfies z.ZodType<ResetPasswordRequest>;

export const updateProfileSchema = z.object({
  displayName: displayName.optional(),
  handle: handleSchema.optional(),
  bio: z.string().trim().max(280).optional(),
  photoUrl: z.url({ protocol: /^https$/ }).max(500).nullable().optional(),
  isChef: z.boolean().optional(),
}) satisfies z.ZodType<UpdateProfileRequest>;

export const deleteAccountSchema = z.object({
  password: z.string().max(128).optional(),
  confirm: z.literal('DELETE').optional(),
}) satisfies z.ZodType<DeleteAccountRequest>;

export const registerDeviceSchema = z.object({
  pushToken: z.string().min(10).max(300),
  platform: z.enum(['ios', 'android']),
  appVersion: z.string().max(40).optional(),
}) satisfies z.ZodType<RegisterDeviceRequest>;

/** Checks input against a schema; a failure becomes a 400 with one message per field. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input ?? {});
  if (result.success) return result.data;
  const details: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    details[key] ??= issue.message;
  }
  throw errors.validation(details);
}
