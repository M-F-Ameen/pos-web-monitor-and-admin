'use client';

import React, { useState } from 'react';
import {
  DashboardLayout,
  PageContainer,
  KPICard,
  DataTable,
  Dialog,
  ErrorBoundary,
  StatusBadge,
  LoadingState,
  EmptyState,
  ErrorState,
} from '@/components';
import { Return } from '@/types/api';
import { formatCurrency, formatDateTime } from '@/lib/rtl-utils';
import { useReturnsList } from '@/hooks/useQueries';

export default function ReturnsPage() {
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filters: Record<string, any> = {};
  if (searchQuery) filters.search = searchQuery;

  const { data: returnsData, isLoading, error, refetch } = useReturnsList(filters);
  const returns = returnsData?.items ?? [];

  const handleRowClick = (returnItem: Return) => {
    setSelectedReturn(returnItem);
    setIsDialogOpen(true);
  };

  const totalRefunded = returns.reduce((sum, r) => sum + Number(r.refund_amount), 0);
  const totalItems = returns.reduce((sum, r) => sum + Number(r.quantity), 0);

  return (
    <ErrorBoundary>
      <DashboardLayout pageTitle="المرتجعات" pageSubtitle="قائمة المنتجات المرتجعة" onRefresh={() => refetch()}>
        <PageContainer>
          <div className="mb-8">
            <div className="grid-kpi">
              <KPICard label="إجمالي المرتجعات" value={returnsData?.total ?? 0} variant="negative" icon="🔄" isLoading={isLoading} />
              <KPICard label="إجمالي المبلغ المسترد" value={totalRefunded} variant="negative" icon="💸" isCurrency isLoading={isLoading} />
              <KPICard label="إجمالي الكميات" value={totalItems} variant="neutral" icon="📦" isLoading={isLoading} />
            </div>
          </div>

          <div className="mb-6">
            <div className="panel-surface-soft p-3">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-secondary">🔎</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث برقم المرتجع أو اسم المنتج..."
                  className="input-soft py-3 pr-10 pl-4"
                />
              </div>
            </div>
          </div>

          {error ? (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          ) : isLoading ? (
            <LoadingState rows={5} />
          ) : returns.length === 0 ? (
            <EmptyState title="لا توجد مرتجعات" />
          ) : (
            <div className="panel-surface overflow-hidden">
              <DataTable<Return>
                columns={[
                  { key: 'return_number', label: 'رقم المرتجع' },
                  { key: 'created_at', label: 'التاريخ', render: (value) => formatDateTime(value) },
                  { key: 'product_name', label: 'اسم المنتج' },
                  { key: 'quantity', label: 'الكمية' },
                  { key: 'refund_amount', label: 'المبلغ المسترد', render: (value) => formatCurrency(value) },
                ]}
                data={returns}
                rowKey="id"
                onRowClick={handleRowClick}
              />
            </div>
          )}

          <Dialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={`تفاصيل المرتجع - ${selectedReturn?.return_number}`} size="md">
            {selectedReturn && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-text-secondary font-medium">رقم المرتجع</p><p className="font-semibold">{selectedReturn.return_number}</p></div>
                  <div><p className="text-xs text-text-secondary font-medium">التاريخ</p><p className="font-semibold">{formatDateTime(selectedReturn.created_at)}</p></div>
                  <div><p className="text-xs text-text-secondary font-medium">اسم المنتج</p><p className="font-semibold">{selectedReturn.product_name}</p></div>
                  <div><p className="text-xs text-text-secondary font-medium">معالج من قبل</p><p className="font-semibold">{selectedReturn.processed_by}</p></div>
                </div>
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between"><span className="text-text-secondary">الكمية</span><span className="font-semibold">{selectedReturn.quantity}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">السبب</span><span className="font-semibold">{selectedReturn.reason}</span></div>
                  <div className="flex justify-between border-t pt-2 font-bold text-lg">
                    <span>المبلغ المسترد</span>
                    <span className="text-negative-600">{formatCurrency(selectedReturn.refund_amount)}</span>
                  </div>
                </div>
                <StatusBadge status={selectedReturn.status} />
              </div>
            )}
          </Dialog>
        </PageContainer>
      </DashboardLayout>
    </ErrorBoundary>
  );
}
