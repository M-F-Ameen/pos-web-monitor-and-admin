import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  message?: string;
  rows?: number;
  className?: string;
}

/**
 * Loading State Component
 * Displays skeleton loaders during data fetching
 */
export function LoadingState({
  message = 'جاري التحميل...',
  rows = 5,
  className,
}: LoadingStateProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Skeleton Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-12 rounded-lg"
        />
      ))}
      {/* Loading Message */}
      <p className="text-center text-text-secondary text-sm mt-8">
        {message}
      </p>
    </div>
  );
}

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Empty State Component
 * Displays when no data is available
 */
export function EmptyState({
  title = 'لا توجد بيانات',
  description = 'حاول تعديل عوامل التصفية أو التحقق من الأنشطة الأخرى',
  icon = '📭',
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4',
        className
      )}
    >
      {icon && <div className="text-4xl mb-4 opacity-50">{icon}</div>}
      <h3 className="text-lg font-semibold text-text-primary mb-2">
        {title}
      </h3>
      <p className="text-text-secondary text-sm text-center max-w-sm mb-6">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="btn-primary"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Error State Component
 * Displays when an error occurs
 */
export function ErrorState({
  title = 'حدث خطأ',
  message = 'فشل في تحميل البيانات. يرجى المحاولة مرة أخرى.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 bg-negative-50 rounded-lg border border-negative-200',
        className
      )}
    >
      <div className="text-4xl mb-4">⚠️</div>
      <h3 className="text-lg font-semibold text-negative-700 mb-2">
        {title}
      </h3>
      <p className="text-negative-600 text-sm text-center max-w-sm mb-6">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="bg-negative-600 hover:bg-negative-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
        >
          حاول مرة أخرى
        </button>
      )}
    </div>
  );
}
