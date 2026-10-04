'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase-client';

// ---------- Client-side rate limiting (UX guard only; not a security control) ----------
const SIGNUP_RATE_LIMIT_KEY = 'followthru_signup_attempts';
const MAX_ATTEMPTS = 3;
const ATTEMPT_WINDOW_MS = 60000;

interface SignupAttempt {
  timestamp: number;
  count: number;
}

function readAttempts(): SignupAttempt {
  const fresh = { timestamp: Date.now(), count: 0 };
  if (typeof window === 'undefined') return fresh;
  try {
    const stored = localStorage.getItem(SIGNUP_RATE_LIMIT_KEY);
    if (!stored) return fresh;
    const parsed = JSON.parse(stored) as SignupAttempt;
    if (Date.now() - parsed.timestamp > ATTEMPT_WINDOW_MS) return fresh;
    return parsed;
  } catch {
    return fresh;
  }
}

function recordSignupAttempt() {
  const attempts = readAttempts();
  attempts.count += 1;
  try {
    localStorage.setItem(SIGNUP_RATE_LIMIT_KEY, JSON.stringify(attempts));
  } catch {
    /* ignore */
  }
  const allowed = attempts.count <= MAX_ATTEMPTS;
  const remaining = Math.max(0, MAX_ATTEMPTS - attempts.count);
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((attempts.timestamp + ATTEMPT_WINDOW_MS - Date.now()) / 1000),
  );
  return { allowed, remaining, retryAfterSeconds };
}

function clearSignupAttempts() {
  try {
    localStorage.removeItem(SIGNUP_RATE_LIMIT_KEY);
  } catch {
    /* ignore */
  }
}

// ---------- Component ----------
type Step = 'account' | 'personal' | 'contact' | 'professional';
const STEPS: Step[] = ['account', 'personal', 'contact', 'professional'];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9\s\-+()]+$/;

export default function SignupPage() {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<Step>('account');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Personal
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Contact
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Professional
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');

  const currentStepIndex = STEPS.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const validateAccountStep = (): boolean => {
    if (!email.trim()) return fail('Email is required.');
    if (!EMAIL_REGEX.test(email.trim())) return fail('Please enter a valid email address.');
    if (password.length < 6) return fail('Password must be at least 6 characters.');
    if (password !== confirmPassword) return fail('Passwords do not match.');
    return true;
  };

  const validatePersonalStep = (): boolean => {
    if (!fullName.trim()) return fail('Full name is required.');
    if (fullName.trim().length < 2) return fail('Full name must be at least 2 characters.');
    if (fullName.trim().length > 100) return fail('Full name must be at most 100 characters.');
    return true;
  };

  const validateContactStep = (): boolean => {
    if (contactEmail.trim() && !EMAIL_REGEX.test(contactEmail.trim())) {
      return fail('Please enter a valid contact email address.');
    }
    if (phone.trim()) {
      if (!PHONE_REGEX.test(phone.trim())) return fail('Please enter a valid phone number.');
      if (phone.trim().length > 20) return fail('Phone number must be at most 20 characters.');
    }
    return true;
  };

  function fail(message: string): false {
    setError(message);
    return false;
  }

  const handleNext = () => {
    setError(null);
    setSuccessMessage(null);

    if (currentStep === 'account' && !validateAccountStep()) return;
    if (currentStep === 'personal' && !validatePersonalStep()) return;
    if (currentStep === 'contact' && !validateContactStep()) return;

    setCurrentStep(STEPS[Math.min(currentStepIndex + 1, STEPS.length - 1)]);
  };

  const handlePrevious = () => {
    setError(null);
    setSuccessMessage(null);
    setCurrentStep(STEPS[Math.max(currentStepIndex - 1, 0)]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    // Enter key on an earlier step should advance the wizard, not submit.
    if (!isLastStep) {
      handleNext();
      return;
    }

    setError(null);
    setSuccessMessage(null);

    // Re-validate everything (user may have edited earlier steps and come back)
    if (!validateAccountStep()) {
      setCurrentStep('account');
      return;
    }
    if (!validatePersonalStep()) {
      setCurrentStep('personal');
      return;
    }
    if (!validateContactStep()) {
      setCurrentStep('contact');
      return;
    }

    const { allowed, remaining, retryAfterSeconds } = recordSignupAttempt();
    if (!allowed) {
      setError(
        `Too many sign-up attempts. Please try again in ${retryAfterSeconds} second${
          retryAfterSeconds !== 1 ? 's' : ''
        }.`,
      );
      return;
    }

    setLoading(true);

    const profilePayload = {
      full_name: fullName.trim(),
      display_name: displayName.trim() || fullName.trim().split(/\s+/)[0],
      email: contactEmail.trim() || null,
      phone: phone.trim() || null,
      company: company.trim() || null,
      job_title: jobTitle.trim() || null,
      bio: bio.trim() || null,
      location: location.trim() || null,
      avatar_url: null,
    };

    try {
      // Step 1: create the auth account.
      // The profile is ALSO stored in user metadata so it can be created on first login
      // when email confirmation is enabled (no session exists right after signUp then).
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { signup_profile: profilePayload },
          // Must be in Supabase Auth > URL Configuration > Redirect URLs
          emailRedirectTo:
            typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
        },
      });

      if (signUpError) {
        const rateLimited =
          signUpError.status === 429 ||
          /429|too many requests|rate limit/i.test(signUpError.message || '');
        if (rateLimited) {
          setError(
            `Sign-up service is busy. Please wait a minute and try again${
              remaining > 0 ? ` (${remaining} attempt${remaining !== 1 ? 's' : ''} left)` : ''
            }.`,
          );
        } else {
          setError(signUpError.message);
        }
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Sign up failed. Please try again.');
        setLoading(false);
        return;
      }

      // Supabase returns an obfuscated user with no identities if the email is already registered
      if (authData.user.identities && authData.user.identities.length === 0) {
        setError('An account with this email already exists. Please sign in instead.');
        setLoading(false);
        return;
      }

      clearSignupAttempts();

      // Step 2a: email confirmation required -> no session yet.
      if (!authData.session) {
        setSuccessMessage(
          'Account created! Please check your email to confirm your address, then sign in. Your profile details have been saved.',
        );
        setLoading(false);
        setTimeout(() => router.push('/login'), 4000);
        return;
      }

      // Step 2b: session exists -> create the profile now using the fresh token.
      let profileSaved = false;
      try {
        const profileResponse = await fetch('/api/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authData.session.access_token}`,
          },
          body: JSON.stringify(profilePayload),
        });
        profileSaved = profileResponse.ok;
        if (!profileResponse.ok) {
          const errorData = await profileResponse.json().catch(() => ({}));
          console.error('Profile creation failed:', errorData);
        }
      } catch (profileErr) {
        console.error('Profile creation network error:', profileErr);
      }

      // Even if the POST failed, GET /api/profile re-creates the profile from the
      // signup metadata on next load, so the account is still usable.
      setSuccessMessage(
        profileSaved
          ? 'Account created successfully! Redirecting to dashboard...'
          : 'Account created! We\'ll finish setting up your profile shortly. Redirecting...',
      );
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err) {
      console.error('Signup error:', err);
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.',
      );
      setLoading(false);
    }
  };

  const stepSubtitle: Record<Step, string> = {
    account: 'Account security',
    personal: 'Personal information',
    contact: 'Contact details',
    professional: 'Professional background',
  };

  const inputClass = 'border-gray-200';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Create your account</h1>
          <p className="mt-1 text-sm text-gray-500">{stepSubtitle[currentStep]}</p>
          <div className="mt-3 flex gap-1">
            {STEPS.map((step, index) => (
              <div
                key={step}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  index <= currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        >
          {currentStep === 'account' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className={labelClass}>
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={loading}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-gray-500">We'll use this to verify your account</p>
              </div>

              <div>
                <Label htmlFor="password" className={labelClass}>
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  disabled={loading}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-gray-500">Must be at least 6 characters</p>
              </div>

              <div>
                <Label htmlFor="confirmPassword" className={labelClass}>
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  disabled={loading}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {currentStep === 'personal' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName" className={labelClass}>
                  Full Name *
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  disabled={loading}
                  className={inputClass}
                />
              </div>

              <div>
                <Label htmlFor="displayName" className={labelClass}>
                  Display Name
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How you'll appear in meetings (e.g., Akash)"
                  disabled={loading}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Leave blank to use first name from full name
                </p>
              </div>
            </div>
          )}

          {currentStep === 'contact' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="contactEmail" className={labelClass}>
                  Contact Email (Optional)
                </Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="Alternative email address"
                  disabled={loading}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-gray-500">Different from your account email</p>
              </div>

              <div>
                <Label htmlFor="phone" className={labelClass}>
                  Phone Number (Optional)
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  maxLength={20}
                  disabled={loading}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {currentStep === 'professional' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="company" className={labelClass}>
                  Company (Optional)
                </Label>
                <Input
                  id="company"
                  type="text"
                  autoComplete="organization"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company name"
                  disabled={loading}
                  className={inputClass}
                />
              </div>

              <div>
                <Label htmlFor="jobTitle" className={labelClass}>
                  Job Title (Optional)
                </Label>
                <Input
                  id="jobTitle"
                  type="text"
                  autoComplete="organization-title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g., Product Manager"
                  disabled={loading}
                  className={inputClass}
                />
              </div>

              <div>
                <Label htmlFor="location" className={labelClass}>
                  Location (Optional)
                </Label>
                <Input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, Country"
                  disabled={loading}
                  className={inputClass}
                />
              </div>

              <div>
                <Label htmlFor="bio" className={labelClass}>
                  Bio (Optional)
                </Label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  disabled={loading}
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {successMessage && (
            <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{successMessage}</div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {!isFirstStep && (
              <Button
                key="back"
                type="button"
                onClick={handlePrevious}
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
            {!isLastStep ? (
              <Button
                key="next"
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                key="submit"
                type="submit"
                disabled={loading || !!successMessage}
                className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            )}
          </div>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}