'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';

const API_BASE = process.env.NEXT_PUBLIC_CLOUD_API_URL || 'http://localhost:4000/api';

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  domain: string;
  apiKey: string;
  monitorKey: string;
  isActive: boolean;
  maxStores: number;
  maxUsers: number;
  createdAt: string;
}

interface TenantUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getAuthHeaders, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!token) { router.push('/admin/login'); return; }
    fetchTenant();
  }, [id, token, authLoading]);

  const fetchTenant = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/tenants/${id}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setTenant(data.tenant);
        setUsers(data.users);
      } else setError(data.error);
    } catch { setError('Failed to load tenant'); }
    finally { setLoading(false); }
  };

  const copyToClipboard = (key: string, label: string) => {
    navigator.clipboard.writeText(key);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-text-secondary">جاري التحميل...</div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-red-600">{error || 'لم يتم العثور على المتجر'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6" dir="rtl">
      <div className="mx-auto max-w-4xl">
        <button onClick={() => router.push('/admin')} className="text-sm text-primary-600 hover:underline mb-4 inline-block">
          ← العودة إلى قائمة المتاجر
        </button>

        {copied && (
          <div className="mb-4 rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700 text-center">
            تم نسخ {copied}
          </div>
        )}

        <div className="rounded-2xl border border-white/20 bg-white p-6 shadow-lg mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-primary-900">{tenant.name}</h1>
              <p className="text-text-secondary text-sm mt-1">Slug: {tenant.slug}</p>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${tenant.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {tenant.isActive ? 'نشط' : 'موقوف'}
            </span>
          </div>

          <h2 className="text-lg font-semibold mb-3">مفاتيح API</h2>
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
              <div>
                <span className="text-sm font-medium">API Key (للتطبيق)</span>
                <div className="text-xs text-text-secondary mt-1 font-mono break-all">{tenant.apiKey}</div>
              </div>
              <button onClick={() => copyToClipboard(tenant.apiKey, 'مفتاح API')} className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shrink-0 mr-3">
                نسخ
              </button>
            </div>
            <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
              <div>
                <span className="text-sm font-medium">Monitor Key (للوحة المراقبة)</span>
                <div className="text-xs text-text-secondary mt-1 font-mono break-all">{tenant.monitorKey}</div>
              </div>
              <button onClick={() => copyToClipboard(tenant.monitorKey, 'مفتاح المراقبة')} className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shrink-0 mr-3">
                نسخ
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/20 bg-white p-6 shadow-lg">
          <h2 className="text-lg font-semibold mb-4">المستخدمين ({users.length})</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-right p-3 text-sm font-semibold">الاسم</th>
                <th className="text-right p-3 text-sm font-semibold">البريد</th>
                <th className="text-center p-3 text-sm font-semibold">الدور</th>
                <th className="text-center p-3 text-sm font-semibold">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-50">
                  <td className="p-3 text-sm">{u.name}</td>
                  <td className="p-3 text-sm text-text-secondary">{u.email}</td>
                  <td className="p-3 text-sm text-center">{u.role === 'owner' ? 'مدير' : u.role}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.isActive ? 'نشط' : 'غير نشط'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
