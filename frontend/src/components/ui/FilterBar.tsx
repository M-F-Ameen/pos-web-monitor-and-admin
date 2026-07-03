import React from 'react';
import { cn } from '@/lib/utils';

export interface FilterOption {
  id: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'daterange';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: any;
}

interface FilterBarProps {
  filters: FilterOption[];
  onFilterChange: (filters: Record<string, any>) => void;
  onReset?: () => void;
  className?: string;
}

/**
 * Filter Bar Component
 * Reusable filter controls for tables and lists
 */
export function FilterBar({
  filters,
  onFilterChange,
  onReset,
  className,
}: FilterBarProps) {
  const [values, setValues] = React.useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    filters.forEach((f) => {
      initial[f.id] = f.defaultValue ?? '';
    });
    return initial;
  });

  const handleChange = (id: string, value: any) => {
    const newValues = { ...values, [id]: value };
    setValues(newValues);
    onFilterChange(newValues);
  };

  const handleReset = () => {
    const reset: Record<string, any> = {};
    filters.forEach((f) => {
      reset[f.id] = '';
    });
    setValues(reset);
    onReset?.();
  };

  return (
    <div
      className={cn(
        'panel-surface space-y-4 p-4 sm:p-5',
        className
      )}
    >
      {/* Filter Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filters.map((filter) => {
          if (filter.type === 'text') {
            return (
              <div key={filter.id}>
                <label className="block text-xs font-medium text-text-secondary mb-2">
                  {filter.label}
                </label>
                <input
                  type="text"
                  placeholder={filter.placeholder}
                  value={values[filter.id] ?? ''}
                  onChange={(e) => handleChange(filter.id, e.target.value)}
                  className="input-soft"
                />
              </div>
            );
          }

          if (filter.type === 'select') {
            return (
              <div key={filter.id}>
                <label className="block text-xs font-medium text-text-secondary mb-2">
                  {filter.label}
                </label>
                <select
                  value={values[filter.id] ?? ''}
                  onChange={(e) => handleChange(filter.id, e.target.value)}
                  className="input-soft"
                >
                  <option value="">الكل</option>
                  {filter.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          if (filter.type === 'date') {
            return (
              <div key={filter.id}>
                <label className="block text-xs font-medium text-text-secondary mb-2">
                  {filter.label}
                </label>
                <input
                  type="date"
                  value={values[filter.id] ?? ''}
                  onChange={(e) => handleChange(filter.id, e.target.value)}
                  className="input-soft"
                />
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 border-t border-white/50 pt-4">
        {onReset && (
          <button
            onClick={handleReset}
            className="btn-secondary text-xs"
          >
            مسح الفلاتر
          </button>
        )}
      </div>
    </div>
  );
}
