'use client';

import React, { useState } from 'react';
import {
  DashboardLayout,
  PageContainer,
  KPICard,
  DataTable,
  FilterBar,
  Dialog,
  ErrorBoundary,
  StatusBadge,
  LoadingState,
  EmptyState,
  ErrorState,
} from '@/components';
import { Sale, FilterOption } from '@/types/api';
import { formatCurrency, formatDateTime } from '@/lib/rtl-utils';
import { useSalesList } from '@/hooks/useQueries';

const filterOptions: FilterOption[] = [
  {
    id: 'search',
    label: 'بحث',
    type: 'text',
    placeholder: 'رقم الفاتورة، اسم العميل أو الكاشير',
  },
  {
    id: 'fromDate',
    label: 'من التاريخ',
    type: 'date',
  },
  {
    id: 'toDate',
    label: 'إلى التاريخ',
    type: 'date',
  },
];

export default function SalesPage() {
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, any>>({});

  const { data: salesData, isLoading, error, refetch } = useSalesList(filters);

  const sales = salesData?.items ?? [];
  const total = salesData?.total ?? 0;

  const handleRowClick = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDialogOpen(true);
  };

  const totalSales = sales.reduce((sum, s) => sum + Number(s.total), 0);

  return (
    <ErrorBoundary>
      <DashboardLayout
        pageTitle="المبيعات"
        pageSubtitle="متابعة المبيعات المباشرة وحركة الفواتير"
        onRefresh={() => refetch()}
        refreshStatus={isLoading ? 'يتم التحديث' : 'متصل'}
      >
        <PageContainer>
          <div className="mb-8">
            <div className="grid-kpi">
              <KPICard
                label="إجمالي المبيعات"
                value={totalSales}
                variant="positive"
                icon="💰"
                isCurrency
                isLoading={isLoading}
              />
              <KPICard
                label="عدد الفواتير"
                value={total}
                variant="neutral"
                icon="📊"
                isLoading={isLoading}
              />
            </div>
          </div>

          <div className="mb-6">
            <FilterBar
              filters={filterOptions}
              onFilterChange={setFilters}
              onReset={() => setFilters({})}
            />
          </div>

          {error ? (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          ) : isLoading ? (
            <LoadingState rows={5} />
          ) : sales.length === 0 ? (
            <EmptyState title="لا توجد مبيعات" description="لم يتم تسجيل أي مبيعات بعد" />
          ) : (
            <div className="panel-surface overflow-hidden">
              <DataTable<Sale>
                columns={[
                  { key: 'receipt_number', label: 'رقم الفاتورة' },
                  {
                    key: 'created_at',
                    label: 'التاريخ',
                    render: (value) => formatDateTime(value),
                  },
                  { key: 'customer_name', label: 'العميل', render: (v) => v || 'عميل عام' },
                  { key: 'cashier_name', label: 'الكاشير' },
                  {
                    key: 'total',
                    label: 'الإجمالي',
                    render: (value) => formatCurrency(value),
                  },
                  {
                    key: 'status',
                    label: 'الحالة',
                    render: (value) => <StatusBadge status={value} />,
                  },
                ]}
                data={sales}
                rowKey="id"
                onRowClick={handleRowClick}
              />
            </div>
          )}

          <Dialog
            isOpen={isDialogOpen}
            onClose={() => setIsDialogOpen(false)}
            title={`تفاصيل المبيعة - ${selectedSale?.receipt_number}`}
            size="md"
          >
            {selectedSale && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-text-secondary font-medium">رقم الفاتورة</p>
                    <p className="font-semibold text-text-primary">{selectedSale.receipt_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary font-medium">التاريخ والوقت</p>
                    <p className="font-semibold text-text-primary">{formatDateTime(selectedSale.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary font-medium">العميل</p>
                    <p className="font-semibold text-text-primary">{selectedSale.customer_name || 'عميل عام'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary font-medium">الكاشير</p>
                    <p className="font-semibold text-text-primary">{selectedSale.cashier_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary font-medium">طريقة الدفع</p>
                    <p className="font-semibold text-text-primary">{selectedSale.payment_method}</p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">عدد العناصر</span>
                    <span className="font-semibold">{selectedSale.items?.length ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">الخصم</span>
                    <span className="font-semibold">{formatCurrency(selectedSale.discount_amount)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-bold text-lg">
                    <span>الإجمالي</span>
                    <span className="text-accent-600">{formatCurrency(selectedSale.total)}</span>
                  </div>
                </div>

                <StatusBadge status={selectedSale.status} />
              </div>
            )}
          </Dialog>
        </PageContainer>
      </DashboardLayout>
    </ErrorBoundary>
  );
}
