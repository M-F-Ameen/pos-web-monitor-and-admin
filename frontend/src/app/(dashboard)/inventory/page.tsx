'use client';

import React, { useState } from 'react';
import {
  DashboardLayout,
  PageContainer,
  KPICard,
  DataTable,
  ErrorBoundary,
  LoadingState,
  EmptyState,
  ErrorState,
} from '@/components';
import { InventoryItem } from '@/types/api';
import { formatCurrency } from '@/lib/rtl-utils';
import { useInventory } from '@/hooks/useQueries';

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filters: Record<string, any> = {};
  if (searchQuery) filters.search = searchQuery;

  const { data: inventory, isLoading, error, refetch } = useInventory(filters);
  const items = inventory?.items ?? [];

  return (
    <ErrorBoundary>
      <DashboardLayout pageTitle="المخزون" pageSubtitle="مراقبة المخزون بشكل بسيط" onRefresh={() => refetch()}>
        <PageContainer>
          <div className="mb-8">
            <div className="grid-kpi">
              <KPICard label="إجمالي عدد المنتجات" value={inventory?.totalProducts ?? 0} variant="primary" icon="📦" isLoading={isLoading} />
              <KPICard label="إجمالي وحدات المخزون" value={inventory?.totalUnits ?? 0} variant="neutral" icon="📊" isLoading={isLoading} />
              <KPICard label="قيمة المخزون" value={inventory?.inventoryValue ?? 0} variant="positive" icon="💰" isCurrency isLoading={isLoading} />
              <KPICard label="منتجات منخفضة" value={inventory?.lowStockCount ?? 0} variant="negative" icon="⚠️" isLoading={isLoading} />
            </div>
          </div>

          <div className="panel-surface overflow-hidden">
            <div className="space-y-4 border-b border-white/50 p-4 md:p-6">
              <h3 className="text-lg font-semibold text-text-primary">المنتجات</h3>
              <div className="panel-surface-soft p-3">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-secondary">🔎</span>
                  <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ابحث عن المنتج..." className="input-soft py-3 pr-10 pl-4" />
                </div>
              </div>
            </div>
            {error ? (
              <ErrorState message={error.message} onRetry={() => refetch()} />
            ) : isLoading ? (
              <LoadingState rows={5} />
            ) : items.length === 0 ? (
              <EmptyState title="لا توجد منتجات" />
            ) : (
              <DataTable<InventoryItem>
                columns={[
                  { key: 'productName', label: 'اسم المنتج' },
                  { key: 'category', label: 'التصنيف' },
                  { key: 'stock', label: 'الكمية' },
                  { key: 'unitPrice', label: 'السعر', render: (value) => formatCurrency(value) },
                  { key: 'isLowStock', label: 'حالة المخزون', render: (value) => (
                    <span className={value ? 'text-negative-600 font-semibold' : 'text-success-600'}>{value ? 'منخفض' : 'جيد'}</span>
                  )},
                ]}
                data={items}
                rowKey="id"
              />
            )}
          </div>
        </PageContainer>
      </DashboardLayout>
    </ErrorBoundary>
  );
}
