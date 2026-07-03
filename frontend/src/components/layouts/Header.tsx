import React from 'react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  refreshStatus?: string;
  onMenuClick?: () => void;
  isMenuOpen?: boolean;
  className?: string;
}

/**
 * Header Component
 * Top header bar for dashboard with title, refresh, and menu
 */
export function Header({
  title,
  subtitle,
  onRefresh,
  refreshStatus,
  onMenuClick,
  isMenuOpen = false,
  className,
}: HeaderProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-40 px-3 pt-3 md:px-0 md:pt-0',
        className
      )}
    >
      <div className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-[rgba(188,201,217,0.92)] bg-[linear-gradient(145deg,_rgba(248,250,253,0.94),_rgba(222,231,242,0.98))] px-4 py-4 shadow-[0_20px_40px_rgba(122,136,157,0.2),0_3px_10px_rgba(115,129,151,0.12),inset_1px_1px_0_rgba(255,255,255,0.82)] backdrop-blur-xl sm:px-6 md:px-8">
        {/* Left: Menu Button + Title */}
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="flex flex-col gap-1.5 rounded-2xl border border-[rgba(188,201,217,0.88)] bg-[linear-gradient(145deg,_rgba(249,251,254,0.94),_rgba(225,233,243,0.98))] p-2.5 shadow-[0_10px_20px_rgba(122,136,157,0.16),inset_1px_1px_0_rgba(255,255,255,0.82)] transition-all hover:-translate-y-0.5 md:hidden"
            aria-label="فتح القائمة"
            aria-expanded={isMenuOpen}
          >
            <span className="h-0.5 w-6 rounded-full bg-text-primary"></span>
            <span className="h-0.5 w-6 rounded-full bg-text-primary"></span>
            <span className="h-0.5 w-6 rounded-full bg-text-primary"></span>
          </button>

          {/* Title Section */}
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-bold text-text-primary truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs md:text-sm text-text-secondary truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          {refreshStatus && (
            <span className="whitespace-nowrap rounded-full border border-[rgba(188,201,217,0.84)] bg-[linear-gradient(145deg,_rgba(248,250,253,0.88),_rgba(227,234,244,0.92))] px-3 py-1 text-xs font-medium text-text-secondary shadow-[0_6px_14px_rgba(148,163,184,0.1),inset_1px_1px_0_rgba(255,255,255,0.72)]">
              {refreshStatus}
            </span>
          )}

          {/* Refresh Button (global) */}
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={cn(
                'inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium text-white shadow-[0_18px_30px_rgba(42,185,42,0.22),inset_1px_1px_0_rgba(255,255,255,0.28)] transition-all',
                isRefreshing
                  ? 'bg-[linear-gradient(145deg,_rgba(42,185,42,0.86),_rgba(21,128,61,0.86))] opacity-80'
                  : 'bg-[linear-gradient(145deg,_rgba(52,199,63,0.96),_rgba(26,145,49,0.96))] hover:-translate-y-0.5'
              )}
              title="تحديث"
            >
              <span aria-hidden="true">⚡</span>
              <span>تحديث</span>
            </button>
          )}

          {/* User menu removed per request */}
        </div>
      </div>
    </header>
  );
}
