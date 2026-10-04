export const PROFILE_LIMITS = {
  full_name: 100,
  display_name: 50,
  job_title: 100,
  avatar_url: 2048,
  phone: 20, // user_profiles.phone is varchar(20)
  email: 255,
  company: 255,
  location: 255,
  bio: 2000,
} as const;

export type ProfileField = keyof typeof PROFILE_LIMITS;

const FIELDS = Object.keys(PROFILE_LIMITS) as ProfileField[];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9\s\-+()]+$/;

export type ProfileValues = Partial<Record<ProfileField, string | null>>;

export type SanitizeResult =
  | { ok: true; values: ProfileValues }
  | { ok: false; error: string };

export function sanitizeProfileInput(input: unknown, partial: boolean): SanitizeResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Invalid request body.' };
  }
  const raw = input as Record<string, unknown>;
  const values: ProfileValues = {};

  for (const field of FIELDS) {
    const v = raw[field];
    if (v === undefined) continue;

    if (v !== null && typeof v !== 'string') {
      return { ok: false, error: `Invalid value for ${field}.` };
    }

    const trimmed = typeof v === 'string' ? v.trim() : '';
    if (trimmed.length > PROFILE_LIMITS[field]) {
      return {
        ok: false,
        error: `${field.replace('_', ' ')} must be at most ${PROFILE_LIMITS[field]} characters.`,
      };
    }
    values[field] = trimmed === '' ? null : trimmed;
  }

  if (!partial || 'full_name' in values) {
    if (!values.full_name) return { ok: false, error: 'Full name is required.' };
    if (values.full_name.length < 2) {
      return { ok: false, error: 'Full name must be at least 2 characters.' };
    }
  }

  if ('display_name' in values && !values.display_name) {
    if (values.full_name) {
      values.display_name = values.full_name.split(/\s+/)[0];
    } else {
      delete values.display_name;
    }
  }
  if (!partial && !values.display_name) {
    values.display_name = values.full_name!.split(/\s+/)[0];
  }

  if (values.phone && !PHONE_REGEX.test(values.phone)) {
    return { ok: false, error: 'Please enter a valid phone number.' };
  }
  if (values.email && !EMAIL_REGEX.test(values.email)) {
    return { ok: false, error: 'Please enter a valid contact email address.' };
  }
  if (values.avatar_url && !/^https?:\/\//i.test(values.avatar_url)) {
    return { ok: false, error: 'Avatar URL must start with http:// or https://.' };
  }

  return { ok: true, values };
}