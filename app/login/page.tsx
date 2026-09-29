'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import Link from 'next/link';

import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';

import { supabase } from '@/lib/supabase-client';

export default function LoginPage() {

  const router = useRouter();

  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();

    if (!email.trim() || !password) {

      setError('Please enter your email and password.');

      return;

    }

    setError(null);

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({

      email: email.trim(),

      password,

    });

    if (error) {

      setError(

        error.message.includes('Invalid login')

          ? 'Invalid email or password.'

          : error.message,

      );

      setLoading(false);

      return;

    }

    router.push('/dashboard');

  };

  return (

    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">

      <div className="w-full max-w-sm">

        <div className="mb-6 text-center">

          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">

            <CheckCircle2 className="h-5 w-5 text-blue-600" />

          </div>

          <h1 className="text-xl font-bold text-gray-900">

            Sign in to FollowThru

          </h1>

          <p className="mt-1 text-sm text-gray-500">

            Enter your credentials to access your dashboard.

          </p>

        </div>

        <form

          onSubmit={handleSubmit}

          className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"

        >

          <div>

            <label

              htmlFor="email"

              className="mb-1.5 block text-sm font-medium text-gray-700"

            >

              Email

            </label>

            <Input

              id="email"

              type="email"

              value={email}

              onChange={(e) => setEmail(e.target.value)}

              placeholder="you@example.com"

              disabled={loading}

              className="border-gray-200"

            />

          </div>

          <div>

            <label

              htmlFor="password"

              className="mb-1.5 block text-sm font-medium text-gray-700"

            >

              Password

            </label>

            <Input

              id="password"

              type="password"

              value={password}

              onChange={(e) => setPassword(e.target.value)}

              placeholder="••••••••"

              disabled={loading}

              className="border-gray-200"

            />

          </div>

          {error && (

            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">

              <AlertCircle className="h-4 w-4 shrink-0" />

              {error}

            </div>

          )}

          <Button

            type="submit"

            disabled={loading}

            className="w-full bg-blue-600 text-white hover:bg-blue-700"

          >

            {loading ? (

              <>

                <Loader2 className="mr-2 h-4 w-4 animate-spin" />

                Signing in...

              </>

            ) : (

              'Sign in'

            )}

          </Button>

        </form>

        <p className="mt-4 text-center text-sm text-gray-500">

          Don&apos;t have an account?{' '}

          <Link

            href="/signup"

            className="font-medium text-blue-600 hover:text-blue-700"

          >

            Sign up

          </Link>

        </p>

      </div>

    </div>

  );

}
