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
import { Shift } from '@/types/api';
import { formatCurrency, formatDateTime } from '@/lib/rtl-utils';
import { useShiftsList } from '@/hooks/useQueries';

export default function ShiftsPage() {
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filters: Record<string, any> = {};
  if (searchQuery) filters.search = searchQuery;

  const { data: shiftsData, isLoading, error, refetch } = useShiftsList(filters);
  const shifts = shiftsData?.items ?? [];

  const handleRowClick = (shift: Shift) => {
    setSelectedShift(shift);
    setIsDialogOpen(true);
  };

  const openShifts = shifts.filter((s) => s.status === 'open');

  return (
    <ErrorBoundary>
      <DashboardLayout pageTitle="الورديات" pageSubtitle="تتبع ورديات الموظفين" onRefresh={() => refetch()}>
        <PageContainer>
          <div className="mb-8">
            <div className="grid-kpi-sm">
              <KPICard label="الورديات المفتوحة" value={openShifts.length} variant="neutral" icon="🟢" isLoading={isLoading} />
              <KPICard label="إجمالي الموظفين" value={shiftsData?.total ?? 0} variant="primary" icon="👥" isLoading={isLoading} />
            </div>
          </div>

          <div className="panel-surface overflow-hidden">
            <div className="space-y-4 border-b border-white/50 p-4 md:p-6">
              <div className="panel-surface-soft p-3">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-secondary">🔎</span>
                  <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ابحث باسم الموظف..." className="input-soft py-3 pr-10 pl-4" />
                </div>
              </div>
            </div>
            {error ? (
              <ErrorState message={error.message} onRetry={() => refetch()} />
            ) : isLoading ? (
              <LoadingState rows={5} />
            ) : shifts.length === 0 ? (
              <EmptyState title="لا توجد ورديات" />
            ) : (
              <DataTable<Shift>
                columns={[
                  { key: 'userName', label: 'اسم الموظف' },
                  { key: 'status', label: 'الحالة', render: (value) => <StatusBadge status={value} /> },
                  { key: 'startCash', label: 'أموال البداية', render: (value) => formatCurrency(value) },
                  { key: 'metrics', label: 'المبيعات', render: (_v, row) => formatCurrency(row.metrics?.totalSales ?? 0) },
                ]}
                data={shifts}
                rowKey="id"
                onRowClick={handleRowClick}
              />
            )}
          </div>

          <Dialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={`تفاصيل الوردية - ${selectedShift?.userName}`} size="md">
            {selectedShift && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-text-secondary font-medium">اسم الموظف</p><p className="font-semibold">{selectedShift.userName}</p></div>
                  <div><p className="text-xs text-text-secondary font-medium">المنصب</p><p className="font-semibold">{selectedShift.userRole}</p></div>
                  <div><p className="text-xs text-text-secondary font-medium">وقت البداية</p><p className="font-semibold">{formatDateTime(selectedShift.loginAt)}</p></div>
                  <div><p className="text-xs text-text-secondary font-medium">وقت النهاية</p><p className="font-semibold">{selectedShift.logoutAt ? formatDateTime(selectedShift.logoutAt) : 'قيد العمل'}</p></div>
                </div>
                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between"><span className="text-text-secondary">أموال البداية</span><span className="font-semibold">{formatCurrency(selectedShift.startCash)}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">إجمالي المبيعات</span><span className="font-semibold text-success-600">{formatCurrency(selectedShift.metrics?.totalSales ?? 0)}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">إجمالي المرتجعات</span><span className="font-semibold text-negative-600">{formatCurrency(selectedShift.metrics?.totalReturns ?? 0)}</span></div>
                  {selectedShift.logoutAt && (
                    <>
                      <div className="border-t pt-2">
                        <div className="flex justify-between"><span className="text-text-secondary">أموال النهاية</span><span className="font-semibold">{formatCurrency(selectedShift.endCash ?? 0)}</span></div>
                        <div className="flex justify-between border-t pt-2 font-bold text-lg">
                          <span>صافي النقد</span>
                          <span className={(selectedShift.metrics?.netCash ?? 0) > 0 ? 'text-success-600' : 'text-negative-600'}>{formatCurrency(selectedShift.metrics?.netCash ?? 0)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <StatusBadge status={selectedShift.status} />
              </div>
            )}
          </Dialog>
        </PageContainer>
      </DashboardLayout>
    </ErrorBoundary>
  );
}
