import type { Metadata } from 'next';
import { DashboardLayout } from '@/components';

export const metadata: Metadata = {
  title: 'لوحة التحكم - نظام POS',
  description: 'لوحة تحكم شاملة لمراقبة العمليات',
};

interface DashboardRootLayoutProps {
  children: React.ReactNode;
}

/**
 * Dashboard Root Layout
 * Wraps all dashboard pages with DashboardLayout
 * Provides consistent sidebar and header across all pages
 */
export default function DashboardRootLayout({
  children,
}: DashboardRootLayoutProps) {
  return (
    <>
      {/* Dashboard pages will render within DashboardLayout in their page components */}
      {children}
    </>
  );
}
