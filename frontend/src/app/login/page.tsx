'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { loginTenant } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginTenant(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_26%),linear-gradient(145deg,_#143a84_0%,_#0c2b66_42%,_#081e49_100%)] p-4">
      <div className="w-full max-w-md rounded-[2rem] border border-white/20 bg-[linear-gradient(155deg,_rgba(255,255,255,0.96),_rgba(232,238,246,0.95))] p-8 shadow-[0_32px_70px_rgba(0,12,43,0.38),inset_1px_1px_0_rgba(255,255,255,0.9)]">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary-900 mb-2">نظام مراقب</h1>
          <p className="text-text-secondary text-sm">لوحة تحكم الأداء والمبيعات</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 text-center">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-2">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="أدخل البريد الإلكتروني"
              className="input-soft"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-2">
              كلمة المرور
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="أدخل كلمة المرور"
              className="input-soft"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-6 w-full disabled:translate-y-0 disabled:opacity-60"
          >
            {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>

        <p className="text-center text-text-secondary text-xs mt-6">
          © 2024 نظام POS. جميع الحقوق محفوظة.
        </p>
      </div>
    </div>
  );
}
