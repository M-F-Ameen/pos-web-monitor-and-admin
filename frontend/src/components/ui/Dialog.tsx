'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  showCloseButton?: boolean;
}

/**
 * Dialog Component
 * Modal dialog for displaying details or forms
 * Responsive and mobile-friendly
 */
export function Dialog({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
}: DialogProps) {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={cn(
            'w-full rounded-[1.75rem] border border-white/70 bg-[linear-gradient(145deg,_rgba(255,255,255,0.94),_rgba(234,240,247,0.96))] shadow-[0_30px_60px_rgba(15,23,42,0.18),inset_1px_1px_0_rgba(255,255,255,0.92)]',
            sizeStyles[size],
            'max-h-[90vh] overflow-y-auto'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/55 p-6">
            <h2 className="text-lg font-bold text-text-primary">{title}</h2>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="rounded-full border border-white/70 bg-white/45 p-2 text-text-secondary shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)] transition-all hover:-translate-y-0.5 hover:text-text-primary"
                aria-label="Close dialog"
              >
                ✕
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-6">{children}</div>
        </div>
      </div>
    </>
  );
}
