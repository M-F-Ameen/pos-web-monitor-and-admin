import React from 'react';
import { cn } from '@/lib/utils';

export interface TableColumn<T> {
  key: keyof T;
  label: string;
  width?: string;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  isEmpty?: boolean;
  onRowClick?: (row: T, index: number) => void;
  rowKey: keyof T;
  className?: string;
  striped?: boolean;
  hoverable?: boolean;
  pagination?: boolean;
  initialPageSize?: number;
  pageSizeOptions?: number[];
}

type PaginationItem = number | 'ellipsis-start' | 'ellipsis-end';

function getPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, 'ellipsis-end', totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, 'ellipsis-start', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 'ellipsis-start', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-end', totalPages];
}

/**
 * Data Table Component
 * Generic reusable table for displaying data with RTL support
 * Responsive design that works on mobile and desktop
 */
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  isEmpty = false,
  onRowClick,
  rowKey,
  className,
  striped = true,
  hoverable = true,
  pagination = true,
  initialPageSize = 5,
  pageSizeOptions = [5, 10, 20, 50],
}: DataTableProps<T>) {
  const empty = isEmpty || (!isLoading && data.length === 0);
  const resolvedPageSizeOptions = pageSizeOptions.length > 0 ? pageSizeOptions : [initialPageSize];
  const defaultPageSize = resolvedPageSizeOptions.includes(initialPageSize)
    ? initialPageSize
    : resolvedPageSizeOptions[0];

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(defaultPageSize);

  const totalItems = data.length;
  const totalPages = pagination ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;

  React.useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  if (empty) {
    return (
      <div className="py-8 text-center text-text-secondary">
        لا توجد بيانات لعرضها
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  const startIndex = pagination ? (currentPage - 1) * pageSize : 0;
  const endIndex = pagination ? startIndex + pageSize : totalItems;
  const paginatedData = pagination ? data.slice(startIndex, endIndex) : data;
  const paginationItems = getPaginationItems(currentPage, totalPages);
  const visibleFrom = totalItems === 0 ? 0 : startIndex + 1;
  const visibleTo = Math.min(endIndex, totalItems);

  return (
    <div className={cn('table-container', className)}>
      {/* Desktop Table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/50 bg-[linear-gradient(180deg,_rgba(243,246,250,0.94),_rgba(231,237,244,0.82))]">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className="px-6 py-4 text-right text-sm font-semibold text-text-primary"
                  style={{ width: column.width }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, rowIndex) => {
              const absoluteIndex = startIndex + rowIndex;

              return (
                <tr
                  key={String(row[rowKey])}
                  onClick={() => onRowClick?.(row, absoluteIndex)}
                  className={cn(
                    'text-sm shadow-[inset_0_-1px_0_rgba(214,223,233,0.5)]',
                    striped && rowIndex % 2 === 1 && 'bg-white/35',
                    hoverable && 'cursor-pointer transition-all hover:bg-white/65'
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className="px-6 py-4 text-text-primary"
                    >
                      {column.render
                        ? column.render(row[column.key], row, absoluteIndex)
                        : String(row[column.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="space-y-3 p-4 md:hidden">
        {paginatedData.map((row, rowIndex) => {
          const absoluteIndex = startIndex + rowIndex;

          return (
            <div
              key={String(row[rowKey])}
              onClick={() => onRowClick?.(row, absoluteIndex)}
              className={cn(
                'panel-surface-soft space-y-2.5 p-4',
                hoverable && 'cursor-pointer transition-all hover:-translate-y-0.5 hover:bg-white/50'
              )}
            >
              {columns.map((column) => (
                <div key={String(column.key)} className="flex justify-between gap-2">
                  <span className="text-xs font-medium text-text-secondary">
                    {column.label}
                  </span>
                  <span className="text-left text-sm font-medium text-text-primary">
                    {column.render
                      ? column.render(row[column.key], row, absoluteIndex)
                      : String(row[column.key] ?? '-')}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {pagination && (
        <div className="border-t border-white/50 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:gap-4">
              <span>
                عرض {visibleFrom} - {visibleTo} من {totalItems}
              </span>
              <label className="flex items-center gap-2">
                <span>عدد الصفوف</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setCurrentPage(1);
                  }}
                  className="min-w-[5rem] !rounded-xl px-3 py-2 text-sm"
                >
                  {resolvedPageSizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                disabled={currentPage === 1}
                className="pagination-button disabled:translate-y-0 disabled:opacity-50"
              >
                السابق
              </button>

              {paginationItems.map((item) => {
                if (typeof item !== 'number') {
                  return (
                    <span
                      key={item}
                      className="inline-flex min-w-[2rem] items-center justify-center px-1 text-sm text-text-secondary"
                    >
                      ...
                    </span>
                  );
                }

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrentPage(item)}
                    className={cn(
                      'pagination-button',
                      item === currentPage && 'pagination-button-active'
                    )}
                  >
                    {item}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="pagination-button disabled:translate-y-0 disabled:opacity-50"
              >
                التالي
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
