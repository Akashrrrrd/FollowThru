'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase-client';
import { useAuthFetch } from '@/hooks/use-auth-fetch';

export default function SignupPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();
  
  // Form state
  const [currentStep, setCurrentStep] = useState<'account' | 'personal' | 'contact' | 'professional'>(
    'account'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Account section
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Personal section
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Contact section
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Professional section
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');

  const steps: Array<'account' | 'personal' | 'contact' | 'professional'> = [
    'account',
    'personal',
    'contact',
    'professional',
  ];
  const currentStepIndex = steps.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  const validateAccountStep = (): boolean => {
    if (!email.trim()) {
      setError('Email is required.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }
    return true;
  };

  const validatePersonalStep = (): boolean => {
    if (!fullName.trim()) {
      setError('Full name is required.');
      return false;
    }
    if (fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return false;
    }
    return true;
  };

  const validateContactStep = (): boolean => {
    if (phone && !/^[0-9\s\-\+\(\)]+$/.test(phone)) {
      setError('Please enter a valid phone number.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError(null);
    setSuccessMessage(null);

    if (currentStep === 'account' && !validateAccountStep()) return;
    if (currentStep === 'personal' && !validatePersonalStep()) return;
    if (currentStep === 'contact' && !validateContactStep()) return;

    const nextIndex = Math.min(currentStepIndex + 1, steps.length - 1);
    setCurrentStep(steps[nextIndex]);
  };

  const handlePrevious = () => {
    setError(null);
    setSuccessMessage(null);
    const prevIndex = Math.max(currentStepIndex - 1, 0);
    setCurrentStep(steps[prevIndex]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Final validation
    if (!validatePersonalStep() || !validateContactStep()) {
      return;
    }

    setLoading(true);

    try {
      // Step 1: Sign up with auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Sign up failed. Please try again.');
        setLoading(false);
        return;
      }

      // Step 2: Create user profile with all collected information
      const profileResponse = await authFetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          display_name: displayName.trim() || fullName.trim().split(' ')[0],
          email: contactEmail.trim() || null,
          phone: phone.trim() || null,
          company: company.trim() || null,
          job_title: jobTitle.trim() || null,
          bio: bio.trim() || null,
          location: location.trim() || null,
          avatar_url: null,
        }),
      });

      if (!profileResponse.ok) {
        const errorData = await profileResponse.json();
        setError(errorData.error || 'Failed to create profile. Please contact support.');
        setLoading(false);
        return;
      }

      setSuccessMessage('Account created successfully! Redirecting to dashboard...');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err) {
      console.error('Signup error:', err);
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.'
      );
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Create your account</h1>
          <p className="mt-1 text-sm text-gray-500">
            {currentStep === 'account' && 'Account security'}
            {currentStep === 'personal' && 'Personal information'}
            {currentStep === 'contact' && 'Contact details'}
            {currentStep === 'professional' && 'Professional background'}
          </p>
          <div className="mt-3 flex gap-1">
            {steps.map((step, index) => (
              <div
                key={step}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  index <= currentStepIndex
                    ? 'bg-blue-600'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          {/* Account Step */}
          {currentStep === 'account' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={loading}
                  className="border-gray-200"
                />
                <p className="text-xs text-gray-500 mt-1">We'll use this to verify your account</p>
              </div>

              <div>
                <Label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  disabled={loading}
                  className="border-gray-200"
                />
                <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  disabled={loading}
                  className="border-gray-200"
                />
              </div>
            </div>
          )}

          {/* Personal Step */}
          {currentStep === 'personal' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full Name *
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  disabled={loading}
                  className="border-gray-200"
                />
              </div>

              <div>
                <Label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Display Name
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How you'll appear in meetings (e.g., Akash)"
                  disabled={loading}
                  className="border-gray-200"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank to use first name from full name
                </p>
              </div>
            </div>
          )}

          {/* Contact Step */}
          {currentStep === 'contact' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Contact Email (Optional)
                </Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="Alternative email address"
                  disabled={loading}
                  className="border-gray-200"
                />
                <p className="text-xs text-gray-500 mt-1">Different from your account email</p>
              </div>

              <div>
                <Label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone Number (Optional)
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  disabled={loading}
                  className="border-gray-200"
                />
              </div>
            </div>
          )}

          {/* Professional Step */}
          {currentStep === 'professional' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Company (Optional)
                </Label>
                <Input
                  id="company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company name"
                  disabled={loading}
                  className="border-gray-200"
                />
              </div>

              <div>
                <Label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Job Title (Optional)
                </Label>
                <Input
                  id="jobTitle"
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g., Product Manager"
                  disabled={loading}
                  className="border-gray-200"
                />
              </div>

              <div>
                <Label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Location (Optional)
                </Label>
                <Input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, Country"
                  disabled={loading}
                  className="border-gray-200"
                />
              </div>

              <div>
                <Label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Bio (Optional)
                </Label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  disabled={loading}
                  rows={3}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* Success */}
          {successMessage && (
            <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div>{successMessage}</div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            {!isFirstStep && (
              <Button
                type="button"
                onClick={handlePrevious}
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            {!isLastStep && (
              <Button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {isLastStep && (
              <Button
                type="submit"
                disabled={loading}
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
