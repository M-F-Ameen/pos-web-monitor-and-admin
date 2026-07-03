import React from 'react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/rtl-utils';

interface KPICardProps {
  label: string;
  value: number | string;
  variant?: 'positive' | 'negative' | 'neutral' | 'primary';
  subtext?: string;
  delta?: number;
  icon?: React.ReactNode;
  className?: string;
  isLoading?: boolean;
  isCurrency?: boolean;
}

/**
 * KPI Card Component
 * Displays a key performance indicator with value, label, and optional delta
 * Used across all dashboard pages for metrics display
 */
export function KPICard({
  label,
  value,
  variant = 'neutral',
  subtext,
  delta,
  icon,
  className,
  isLoading = false,
  isCurrency = false,
}: KPICardProps) {
  const variantStyles = {
    positive: 'bg-[linear-gradient(145deg,_rgba(242,252,245,0.98),_rgba(213,242,223,0.98))] border-[rgba(181,205,192,0.92)]',
    negative: 'bg-[linear-gradient(145deg,_rgba(254,244,244,0.98),_rgba(245,220,220,0.98))] border-[rgba(216,189,189,0.9)]',
    neutral: 'bg-[linear-gradient(145deg,_rgba(250,252,255,0.96),_rgba(224,232,243,0.98))] border-[rgba(188,201,217,0.92)]',
    primary: 'bg-[linear-gradient(145deg,_rgba(242,246,252,0.98),_rgba(214,224,239,0.98))] border-[rgba(181,194,214,0.92)]',
  };

  const valueStyles = {
    positive: 'text-success-700',
    negative: 'text-negative-700',
    neutral: 'text-text-primary',
    primary: 'text-primary-900',
  };

  const deltaStyles = {
    positive: 'text-success-600',
    negative: 'text-negative-600',
    neutral: 'text-text-secondary',
    primary: 'text-primary-600',
  };

  const displayValue = isLoading ? '...' : isCurrency ? formatCurrency(Number(value)) : value;
  const displayDelta = delta !== undefined ? Math.abs(delta).toFixed(1) : null;
  const deltaNumber: number = typeof delta === 'number' ? delta : 0;

  return (
    <div
      className={cn(
        'relative kpi-card',
        variantStyles[variant],
        className
      )}
    >
      {/* Header: Icon + Label */}
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-sm font-medium tracking-wide text-text-secondary">{label}</h3>
        {icon && <span className="text-xl opacity-70">{icon}</span>}
      </div>

      {/* Value Section */}
      <div className="mb-3">
        <p className={cn('text-2xl font-bold md:text-3xl', valueStyles[variant])}>
          {displayValue}
        </p>
      </div>

      {/* Delta + Subtext */}
      {(delta !== undefined || subtext) && (
        <div className="flex items-center justify-between gap-2 text-xs">
          {displayDelta !== null && (
            <div className={cn('flex items-center gap-1 rounded-full px-2 py-1', deltaStyles[variant])}>
              <span>{deltaNumber > 0 ? '↑' : deltaNumber < 0 ? '↓' : '→'}</span>
              <span>{displayDelta}%</span>
            </div>
          )}
          {subtext && (
            <p className="text-text-secondary text-xs">{subtext}</p>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-[1.75rem] bg-white/55 backdrop-blur-sm">
          <div className="w-4 h-4 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}
