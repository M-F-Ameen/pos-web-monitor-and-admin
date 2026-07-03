import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon?: string;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'لوحة التحكم', icon: '📊' },
  { href: '/dashboard/sales', label: 'المبيعات', icon: '💰' },
  { href: '/dashboard/inventory', label: 'المخزون', icon: '📦' },
  { href: '/dashboard/returns', label: 'المرتجعات', icon: '🔄' },
  { href: '/dashboard/treasury', label: 'الخزينة', icon: '🏦' },
  { href: '/dashboard/shifts', label: 'الورديات', icon: '⏰' },
  { href: '/dashboard/reports', label: 'التقارير', icon: '📈' },
  { href: '/dashboard/customers', label: 'العملاء', icon: '👥' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

/**
 * Sidebar Component
 * Navigation sidebar for dashboard with RTL support
 * Responsive: drawer on mobile, permanent on desktop
 */
export function Sidebar({ isOpen = true, onClose, className }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const isMobileOpen = Boolean(isOpen);

  const handleLogout = () => {
    logout();
    onClose?.();
    router.push('/login');
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed top-0 right-0 z-50 flex h-screen w-72 max-w-[85vw] flex-col overflow-hidden border-l border-white/10 bg-[linear-gradient(180deg,_#12357b_0%,_#09275f_48%,_#061a43_100%)] text-white shadow-[0_28px_70px_rgba(0,31,92,0.4),inset_1px_1px_0_rgba(255,255,255,0.14)] transition-transform duration-300 ease-out md:top-4 md:right-4 md:h-[calc(100vh-2rem)] md:rounded-[2rem] md:border md:border-white/10 md:border-r-0',
          isMobileOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0',
          className
        )}
      >
        {/* Logo/Header */}
        <div className="border-b border-white/10 px-6 py-7">
          <h1 className="text-xl font-bold text-white">نظام POS</h1>
          <p className="text-xs text-primary-300 mt-1">لوحة مراقبة المبيعات</p>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300',
                  isActive
                    ? 'border border-white/10 bg-[linear-gradient(145deg,_rgba(42,185,42,0.95),_rgba(28,142,37,0.96))] text-white shadow-[0_16px_28px_rgba(20,83,45,0.32),inset_1px_1px_0_rgba(255,255,255,0.22)]'
                    : 'text-primary-100/85 hover:bg-white/8 hover:text-white'
                )}
              >
                {item.icon && <span className="text-lg opacity-90">{item.icon}</span>}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            <span aria-hidden="true">↩</span>
            <span>تسجيل الخروج</span>
          </button>
          <p className="text-center text-xs text-primary-100/60">© 2024 جميع الحقوق محفوظة</p>
        </div>
      </aside>
    </>
  );
}
