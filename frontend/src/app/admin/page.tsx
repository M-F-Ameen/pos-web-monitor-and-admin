'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';

const API_BASE = process.env.NEXT_PUBLIC_CLOUD_API_URL || 'http://localhost:4000/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  userCount: number;
  maxStores: number;
  maxUsers: number;
  createdAt: string;
}

export default function AdminPage() {
  const { user, token, getAuthHeaders, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', adminEmail: '', adminPassword: '', adminName: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [createdKeys, setCreatedKeys] = useState<{ apiKey: string; monitorKey: string } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!token) { router.push('/admin/login'); return; }
    fetchTenants();
  }, [token, authLoading]);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/tenants`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setTenants(data.items);
      else setError(data.error);
    } catch { setError('Failed to load tenants'); }
    finally { setLoading(false); }
  };

  const createTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/admin/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreate(false);
        setForm({ name: '', slug: '', adminEmail: '', adminPassword: '', adminName: '' });
        setCreatedKeys({ apiKey: data.tenant.apiKey, monitorKey: data.tenant.monitorKey });
        fetchTenants();
      } else {
        setError(data.error || data.details ? JSON.stringify(data.details) : 'Failed to create tenant');
      }
    } catch { setError('Failed to create tenant'); }
    finally { setCreating(false); }
  };

  const toggleTenant = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/tenants/${id}/toggle`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) fetchTenants();
    } catch { setError('Failed to toggle tenant'); }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-text-secondary">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-primary-900">إدارة المتاجر</h1>
            <p className="text-text-secondary text-sm mt-1">
              {user?.name} — {user?.email}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              + متجر جديد
            </button>
            <button onClick={() => { logout(); router.push('/admin/login'); }} className="px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm">
              تسجيل خروج
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {createdKeys && (
          <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-green-800">✅ تم إنشاء المتجر بنجاح</h3>
              <button onClick={() => setCreatedKeys(null)} className="text-green-600 hover:text-green-800 text-sm">إغلاق</button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-green-100">
                <div>
                  <span className="text-sm font-medium">API Key (للتطبيق)</span>
                  <div className="text-xs text-text-secondary mt-1 font-mono break-all">{createdKeys.apiKey}</div>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(createdKeys.apiKey); }} className="px-3 py-1.5 text-xs bg-white border border-green-200 rounded-lg hover:bg-green-50 shrink-0 mr-3">
                  نسخ
                </button>
              </div>
              <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-green-100">
                <div>
                  <span className="text-sm font-medium">Monitor Key (للوحة المراقبة)</span>
                  <div className="text-xs text-text-secondary mt-1 font-mono break-all">{createdKeys.monitorKey}</div>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(createdKeys.monitorKey); }} className="px-3 py-1.5 text-xs bg-white border border-green-200 rounded-lg hover:bg-green-50 shrink-0 mr-3">
                  نسخ
                </button>
              </div>
            </div>
          </div>
        )}

        {showCreate && (
          <div className="mb-6 rounded-2xl border border-white/20 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold mb-4">متجر جديد</h2>
            <form onSubmit={createTenant} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">اسم المتجر</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-soft w-full" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">الاسم المختصر (slug)</label>
                  <input type="text" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} className="input-soft w-full" placeholder="my-shop" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">اسم المدير</label>
                  <input type="text" value={form.adminName} onChange={e => setForm({ ...form, adminName: e.target.value })} className="input-soft w-full" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">البريد الإلكتروني (المدير)</label>
                  <input type="email" value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })} className="input-soft w-full" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">كلمة المرور</label>
                  <input type="password" value={form.adminPassword} onChange={e => setForm({ ...form, adminPassword: e.target.value })} className="input-soft w-full" required minLength={6} />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={creating} className="btn-primary">إنشاء المتجر</button>
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm">إلغاء</button>
              </div>
            </form>
          </div>
        )}

        <div className="rounded-2xl border border-white/20 bg-white shadow-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-right p-4 text-sm font-semibold text-text-primary">المتجر</th>
                <th className="text-right p-4 text-sm font-semibold text-text-primary">Slug</th>
                <th className="text-center p-4 text-sm font-semibold text-text-primary">المستخدمين</th>
                <th className="text-center p-4 text-sm font-semibold text-text-primary">الحالة</th>
                <th className="text-left p-4 text-sm font-semibold text-text-primary">تاريخ الإنشاء</th>
                <th className="text-center p-4 text-sm font-semibold text-text-primary">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="p-4">
                    <button onClick={() => router.push(`/admin/tenants/${t.id}`)} className="font-medium text-primary-700 hover:underline">
                      {t.name}
                    </button>
                  </td>
                  <td className="p-4 text-sm text-text-secondary">{t.slug}</td>
                  <td className="p-4 text-center text-sm">{t.userCount}/{t.maxUsers}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${t.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {t.isActive ? 'نشط' : 'موقوف'}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-text-secondary text-left">{new Date(t.createdAt).toLocaleDateString('ar-EG')}</td>
                  <td className="p-4 text-center">
                    <button onClick={() => toggleTenant(t.id)} className="text-sm text-primary-600 hover:underline ml-3">
                      {t.isActive ? 'إيقاف' : 'تفعيل'}
                    </button>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-secondary">لا يوجد متاجر بعد</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
