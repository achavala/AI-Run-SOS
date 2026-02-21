'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, getRoleDashboardPath } from '@/lib/auth';
import { api } from '@/lib/api';

interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
  };
}

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post<LoginResponse>('/auth/login', {
        email,
        password,
      });

      setAuth(res.accessToken, {
        ...res.user,
        role: res.user.role as Parameters<typeof setAuth>[1]['role'],
      });

      router.replace(getRoleDashboardPath(res.user.role as Parameters<typeof setAuth>[1]['role']));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Invalid credentials. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden w-1/2 flex-col justify-between bg-sidebar p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
            <span className="text-lg font-bold text-white">S</span>
          </div>
          <span className="text-xl font-semibold text-white">StaffingOS</span>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight text-white">
            The operating system
            <br />
            for modern staffing.
          </h1>
          <p className="max-w-md text-lg text-gray-400">
            AI-powered trust and proof layer that transforms how staffing firms
            manage vendors, placements, and revenue.
          </p>

          <div className="grid grid-cols-3 gap-6 pt-8">
            <div>
              <p className="text-3xl font-bold text-indigo-400">98%</p>
              <p className="mt-1 text-sm text-gray-500">Invoice accuracy</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-indigo-400">3.2x</p>
              <p className="mt-1 text-sm text-gray-500">Faster placements</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-indigo-400">$2.4M</p>
              <p className="mt-1 text-sm text-gray-500">Revenue managed</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-600">
          &copy; {new Date().getFullYear()} StaffingOS. All rights reserved.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-6 lg:px-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
              <span className="text-lg font-bold text-white">S</span>
            </div>
            <span className="text-xl font-semibold text-gray-900">StaffingOS</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
              Welcome back
            </h2>
            <p className="text-sm text-gray-500">
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input mt-2"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input mt-2"
                placeholder="Enter your password"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <button type="button" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                Forgot password?
              </button>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
