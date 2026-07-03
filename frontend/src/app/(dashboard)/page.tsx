'use client';

import React from 'react';
import {
  DashboardLayout,
  PageContainer,
  KPICard,
  ErrorBoundary,
  LoadingState,
  ErrorState,
} from '@/components';
import { formatCurrency } from '@/lib/rtl-utils';
import { useOverview } from '@/hooks/useQueries';

export default function DashboardOverviewPage() {
  const { data: overview, isLoading, error, refetch } = useOverview();

  return (
    <ErrorBoundary>
      <DashboardLayout
        pageTitle="لوحة التحكم"
        pageSubtitle="نظرة عامة على أداء المتجر"
        onRefresh={() => refetch()}
        refreshStatus={isLoading ? 'يتم التحديث' : 'متصل'}
      >
        <PageContainer>
          {error ? (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          ) : isLoading ? (
            <LoadingState rows={5} />
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-text-primary mb-4">ملخص اليوم</h2>
                <div className="grid-kpi">
                  <KPICard
                    label="مبيعات اليوم"
                    value={overview?.todaySales ?? 0}
                    variant="positive"
                    icon="💰"
                    isLoading={isLoading}
                  />
                  <KPICard
                    label="إيرادات اليوم"
                    value={overview?.todayRevenue ?? 0}
                    variant="primary"
                    icon="📈"
                    isCurrency
                    isLoading={isLoading}
                  />
                  <KPICard
                    label="مرتجعات اليوم"
                    value={overview?.todayReturns ?? 0}
                    variant="negative"
                    icon="🔄"
                    isLoading={isLoading}
                  />
                </div>
              </div>

              <div className="mb-8">
                <h2 className="text-lg font-semibold text-text-primary mb-4">المخزون والعملاء</h2>
                <div className="grid-kpi">
                  <KPICard
                    label="إجمالي المنتجات"
                    value={overview?.totalProducts ?? 0}
                    variant="neutral"
                    icon="📦"
                    isLoading={isLoading}
                  />
                  <KPICard
                    label="منتجات منخفضة"
                    value={overview?.lowStockProducts ?? 0}
                    variant="negative"
                    icon="⚠️"
                    isLoading={isLoading}
                  />
                  <KPICard
                    label="إجمالي العملاء"
                    value={overview?.totalCustomers ?? 0}
                    variant="primary"
                    icon="👥"
                    isLoading={isLoading}
                  />
                </div>
              </div>
            </>
          )}
        </PageContainer>
      </DashboardLayout>
    </ErrorBoundary>
  );
}
