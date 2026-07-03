'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
  pageTitle: string;
  pageSubtitle?: string;
  onRefresh?: () => void;
  refreshStatus?: string;
  className?: string;
}

/**
 * Dashboard Layout Component
 * Main layout for dashboard pages with sidebar and header
 * Handles responsive mobile navigation
 */
export function DashboardLayout({
  children,
  pageTitle,
  pageSubtitle,
  onRefresh,
  refreshStatus,
  className,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(42,185,42,0.08),_transparent_22%),linear-gradient(155deg,_#f4f7fb_0%,_#dde5ef_52%,_#eef2f7_100%)] md:p-4">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden md:pr-[19rem]">
        {/* Header */}
        <div className="flex w-full min-w-0 flex-1 flex-col overflow-hidden">
          <Header
            title={pageTitle}
            subtitle={pageSubtitle}
            onRefresh={onRefresh ?? (() => window.dispatchEvent(new Event('refresh-data')))}
            refreshStatus={refreshStatus}
            onMenuClick={() => setSidebarOpen((open) => !open)}
            isMenuOpen={sidebarOpen}
          />

          {/* Page Content */}
          <main
            className={cn(
              'flex-1 overflow-y-auto bg-transparent',
              className
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
