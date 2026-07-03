'use client';

import React, { useState } from 'react';
import {
  DashboardLayout,
  PageContainer,
  KPICard,
  DataTable,
  CashMovementChart,
  ErrorBoundary,
  LoadingState,
  ErrorState,
} from '@/components';
import { TreasuryTransaction } from '@/types/api';
import { formatCurrency, formatDateTime } from '@/lib/rtl-utils';
import { useTreasury } from '@/hooks/useQueries';

export default function TreasuryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: treasury, isLoading, error, refetch } = useTreasury();

  const operations = treasury?.operations ?? [];

  const filteredOps = operations.filter((t) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return [t.name, t.user_name, t.type, t.source].some((f) => f?.toLowerCase().includes(q));
  });

  const chartData = operations.length > 0
    ? [...operations]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((op) => ({
          name: new Date(op.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          income: op.type === 'sale' ? Math.abs(op.amount) : 0,
          expenses: op.type === 'expense' || op.type === 'withdrawal' || op.type === 'return' ? Math.abs(op.amount) : 0,
        }))
    : [];

  return (
    <ErrorBoundary>
      <DashboardLayout pageTitle="الخزينة" pageSubtitle="إدارة الأموال والعمليات المالية" onRefresh={() => refetch()}>
        <PageContainer>
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-text-primary mb-4">ملخص الخزينة</h2>
            <div className="grid-kpi">
              <KPICard label="إجمالي المبيعات" value={treasury?.totalSales ?? 0} variant="positive" icon="💰" isCurrency isLoading={isLoading} />
              <KPICard label="إجمالي المرتجعات" value={treasury?.totalReturns ?? 0} variant="negative" icon="🔄" isCurrency isLoading={isLoading} />
              <KPICard label="المسحوبات" value={treasury?.totalWithdrawals ?? 0} variant="neutral" icon="💸" isCurrency isLoading={isLoading} />
              <KPICard label="المصروفات" value={treasury?.totalExpenses ?? 0} variant="negative" icon="📊" isCurrency isLoading={isLoading} />
            </div>
          </div>

          <div className="mb-8">
            <div className="panel-surface p-6">
              <p className="text-sm text-text-secondary mb-2">الأموال الحالية</p>
              <p className="mb-2 text-4xl font-bold text-accent-600 drop-shadow-[0_8px_18px_rgba(42,185,42,0.16)]">
                {isLoading ? '...' : formatCurrency(treasury?.currentCash ?? 0)}
              </p>
              <p className="text-xs text-text-secondary">آخر تحديث: الآن</p>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="mb-8">
              <CashMovementChart data={chartData} title="حركة الأموال" isLoading={isLoading} />
            </div>
          )}

          <div className="panel-surface overflow-hidden">
            <div className="border-b border-white/50 p-4 md:p-6">
              <div className="flex flex-col gap-4">
                <h3 className="text-lg font-semibold text-text-primary">آخر العمليات</h3>
                <div className="panel-surface-soft p-3">
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-secondary">🔎</span>
                    <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ابحث باسم العملية أو المستخدم..." className="input-soft py-3 pr-10 pl-4" />
                  </div>
                </div>
              </div>
            </div>
            {error ? (
              <ErrorState message={error.message} onRetry={() => refetch()} />
            ) : isLoading ? (
              <LoadingState rows={5} />
            ) : (
              <DataTable<TreasuryTransaction>
                columns={[
                  { key: 'date', label: 'التاريخ والوقت', render: (value) => formatDateTime(value) },
                  { key: 'type', label: 'نوع العملية', render: (value) => {
                    const types: Record<string, string> = { sale: 'مبيعة', return: 'مرتجع', withdrawal: 'إنسحاب', expense: 'مصروف', deposit: 'إيداع' };
                    return types[value] || value;
                  }},
                  { key: 'name', label: 'الوصف' },
                  { key: 'amount', label: 'المبلغ', render: (value) => (
                    <span className={value > 0 ? 'text-success-600' : 'text-negative-600'}>{formatCurrency(Math.abs(value))}</span>
                  )},
                  { key: 'user_name', label: 'المستخدم' },
                  { key: 'source', label: 'المصدر' },
                ]}
                data={filteredOps}
                rowKey="id"
              />
            )}
          </div>
        </PageContainer>
      </DashboardLayout>
    </ErrorBoundary>
  );
}
