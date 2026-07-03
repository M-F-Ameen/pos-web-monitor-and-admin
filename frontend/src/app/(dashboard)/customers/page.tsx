'use client';

import React, { useState } from 'react';
import {
  DashboardLayout,
  PageContainer,
  KPICard,
  DataTable,
  Dialog,
  ErrorBoundary,
  LoadingState,
  EmptyState,
  ErrorState,
} from '@/components';
import { Customer } from '@/types/api';
import { formatCurrency, formatDateTime } from '@/lib/rtl-utils';
import { useCustomersList } from '@/hooks/useQueries';

export default function CustomersPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filters: Record<string, any> = {};
  if (searchQuery) filters.search = searchQuery;

  const { data: customersData, isLoading, error, refetch } = useCustomersList(filters);
  const customers = customersData?.items ?? [];

  const handleRowClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDialogOpen(true);
  };

  const customersWithDebt = customers.filter((c) => c.debt > 0);
  const totalDebt = customers.reduce((sum, c) => sum + Number(c.debt), 0);

  return (
    <ErrorBoundary>
      <DashboardLayout pageTitle="العملاء" pageSubtitle="إدارة علاقات العملاء" onRefresh={() => refetch()}>
        <PageContainer>
          <div className="mb-8">
            <div className="grid-kpi">
              <KPICard label="إجمالي العملاء" value={customersData?.total ?? 0} variant="primary" icon="👥" isLoading={isLoading} />
              <KPICard label="إجمالي الديون" value={totalDebt} variant="negative" icon="💳" isCurrency isLoading={isLoading} />
              <KPICard label="عملاء بديون" value={customersWithDebt.length} variant="negative" icon="⚠️" isLoading={isLoading} />
            </div>
          </div>

          <div className="mb-6">
            <div className="panel-surface-soft p-3">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-secondary">🔎</span>
                <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ابحث عن العميل..." className="input-soft py-3 pr-10 pl-4" />
              </div>
            </div>
          </div>

          {error ? (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          ) : isLoading ? (
            <LoadingState rows={5} />
          ) : customers.length === 0 ? (
            <EmptyState title="لا يوجد عملاء" />
          ) : (
            <div className="panel-surface overflow-hidden">
              <DataTable<Customer>
                columns={[
                  { key: 'name', label: 'اسم العميل' },
                  { key: 'phone', label: 'الهاتف' },
                  { key: 'totalSpent', label: 'إجمالي الإنفاق', render: (value) => formatCurrency(value) },
                  { key: 'debt', label: 'الدين', render: (value) => (
                    <span className={value > 0 ? 'text-negative-600 font-semibold' : ''}>{formatCurrency(value)}</span>
                  )},
                  { key: 'created_at', label: 'تاريخ التسجيل', render: (value) => formatDateTime(value) },
                ]}
                data={customers}
                rowKey="id"
                onRowClick={handleRowClick}
              />
            </div>
          )}

          <Dialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={`بيانات العميل - ${selectedCustomer?.name}`} size="md">
            {selectedCustomer && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-text-secondary font-medium">اسم العميل</p><p className="font-semibold">{selectedCustomer.name}</p></div>
                  <div><p className="text-xs text-text-secondary font-medium">الهاتف</p><p className="font-semibold">{selectedCustomer.phone}</p></div>
                  <div><p className="text-xs text-text-secondary font-medium">البريد الإلكتروني</p><p className="font-semibold text-xs break-all">{selectedCustomer.email || '-'}</p></div>
                  <div><p className="text-xs text-text-secondary font-medium">آخر نشاط</p><p className="font-semibold text-xs">{formatDateTime(selectedCustomer.created_at)}</p></div>
                </div>
                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between"><span className="text-text-secondary">عدد الشراءات</span><span className="font-semibold">{selectedCustomer.totalPurchases}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">إجمالي الإنفاق</span><span className="font-semibold text-success-600">{formatCurrency(selectedCustomer.totalSpent)}</span></div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-text-secondary">الدين</span>
                    <span className={`font-bold text-lg ${selectedCustomer.debt > 0 ? 'text-negative-600' : 'text-success-600'}`}>{formatCurrency(selectedCustomer.debt)}</span>
                  </div>
                </div>
                {selectedCustomer.debt > 0 && (
                  <div className="bg-negative-50 border border-negative-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-negative-700">⚠️ هذا العميل لديه ديون معلقة</p>
                  </div>
                )}
              </div>
            )}
          </Dialog>
        </PageContainer>
      </DashboardLayout>
    </ErrorBoundary>
  );
}
