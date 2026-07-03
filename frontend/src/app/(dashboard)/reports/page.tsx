'use client';

import React from 'react';
import {
  DashboardLayout,
  PageContainer,
  KPICard,
  DataTable,
  SalesChart,
  TopProductsChart,
  FilterBar,
  ErrorBoundary,
  LoadingState,
  ErrorState,
} from '@/components';
import { FilterOption, TopProduct, DailySummary } from '@/types/api';
import { formatCurrency, formatDate } from '@/lib/rtl-utils';
import { useReports } from '@/hooks/useQueries';

const filterOptions: FilterOption[] = [
  { id: 'fromDate', label: 'من التاريخ', type: 'date' },
  { id: 'toDate', label: 'إلى التاريخ', type: 'date' },
];

export default function ReportsPage() {
  const [filters, setFilters] = React.useState<Record<string, any>>({});
  const { data: reports, isLoading, error, refetch } = useReports(filters);

  const kpi = reports;
  const topProducts: TopProduct[] = reports?.topProducts ?? [];
  const dailyRows: DailySummary[] = reports?.dailyRows ?? [];

  const chartData = dailyRows.map((d) => ({
    name: formatDate(new Date(d.dateKey)),
    value: d.grossSales,
  }));

  const topProductsChart = topProducts.map((p) => ({
    name: p.name,
    value: p.soldQty,
  }));

  return (
    <ErrorBoundary>
      <DashboardLayout pageTitle="التقارير" pageSubtitle="تحليل وإحصائيات المبيعات" onRefresh={() => refetch()}>
        <PageContainer>
          {error ? (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          ) : (
            <>
              <div className="mb-8">
                <div className="grid-kpi">
                  <KPICard label="إجمالي المبيعات" value={kpi?.grossSales ?? 0} variant="positive" icon="💰" isCurrency isLoading={isLoading} />
                  <KPICard label="إجمالي المرتجعات" value={kpi?.totalRefunds ?? 0} variant="negative" icon="🔄" isCurrency isLoading={isLoading} />
                  <KPICard label="صافي الإيرادات" value={kpi?.netRevenue ?? 0} variant="primary" icon="📈" isCurrency isLoading={isLoading} />
                  <KPICard label="إجمالي الطلبات" value={kpi?.totalOrders ?? 0} variant="neutral" icon="📋" isLoading={isLoading} />
                </div>
              </div>

              <div className="mb-6">
                <FilterBar filters={filterOptions} onFilterChange={setFilters} onReset={() => setFilters({})} />
              </div>

              {isLoading ? (
                <LoadingState rows={5} />
              ) : (
                <>
                  <div className="grid lg:grid-cols-2 gap-6 mb-8">
                    <SalesChart data={chartData} title="اتجاه المبيعات اليومية" type="line" isLoading={isLoading} />
                    <TopProductsChart data={topProductsChart} title="أفضل المنتجات مبيعاً" type="pie" isLoading={isLoading} />
                  </div>

                  {dailyRows.length > 0 && (
                    <div className="panel-surface overflow-hidden">
                      <div className="border-b border-white/50 p-4 md:p-6">
                        <h3 className="text-lg font-semibold text-text-primary">ملخص يومي</h3>
                      </div>
                      <DataTable
                        columns={[
                          { key: 'dateKey', label: 'التاريخ', render: (value) => formatDate(new Date(value)) },
                          { key: 'grossSales', label: 'المبيعات', render: (value) => formatCurrency(value) },
                          { key: 'refunds', label: 'المرتجعات', render: (value) => formatCurrency(value) },
                          { key: 'netRevenue', label: 'الصافي', render: (value) => <span className="text-success-600 font-semibold">{formatCurrency(value)}</span> },
                          { key: 'orders', label: 'عدد الطلبات' },
                        ]}
                        data={dailyRows}
                        rowKey="dateKey"
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </PageContainer>
      </DashboardLayout>
    </ErrorBoundary>
  );
}
