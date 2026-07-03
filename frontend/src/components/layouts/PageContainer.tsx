import React from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Page Container Component
 * Wrapper for page content with consistent padding and responsive layout
 */
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn('page-container', className)}>
      {children}
    </div>
  );
}
