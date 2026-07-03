import React from 'react';
import { cn } from '@/lib/utils';
import { getStatusColor, getStatusLabel } from '@/lib/rtl-utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
  variant?: 'default' | 'outlined';
}

/**
 * Status Badge Component
 * Displays status with appropriate colors and labels
 */
export function StatusBadge({
  status,
  className,
  variant = 'default',
}: StatusBadgeProps) {
  const baseStyles = 'status-badge';
  const colorStyles = getStatusColor(status);

  const variants = {
    default: 'px-2.5 py-0.5',
    outlined: 'px-2.5 py-0.5 border',
  };

  return (
    <span
      className={cn(
        baseStyles,
        colorStyles,
        variants[variant],
        className
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}
