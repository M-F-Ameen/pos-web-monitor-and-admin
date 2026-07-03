/**
 * Query Keys Factory
 * Central place for managing TanStack Query keys
 * Follows the query key factory pattern for consistency and type safety
 */

export const queryKeys = {
  // Overview/Dashboard
  overview: {
    all: ['overview'] as const,
    detail: () => [...queryKeys.overview.all, 'detail'] as const,
  },

  // Sales
  sales: {
    all: ['sales'] as const,
    lists: () => [...queryKeys.sales.all, 'list'] as const,
    list: (filters: Record<string, any>) =>
      [...queryKeys.sales.lists(), filters] as const,
    details: () => [...queryKeys.sales.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.sales.details(), id] as const,
  },

  // Returns
  returns: {
    all: ['returns'] as const,
    lists: () => [...queryKeys.returns.all, 'list'] as const,
    list: (filters: Record<string, any>) =>
      [...queryKeys.returns.lists(), filters] as const,
    details: () => [...queryKeys.returns.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.returns.details(), id] as const,
  },

  // Treasury
  treasury: {
    all: ['treasury'] as const,
    lists: () => [...queryKeys.treasury.all, 'list'] as const,
    list: (filters: Record<string, any>) =>
      [...queryKeys.treasury.lists(), filters] as const,
    summary: () => [...queryKeys.treasury.all, 'summary'] as const,
  },

  // Shifts
  shifts: {
    all: ['shifts'] as const,
    lists: () => [...queryKeys.shifts.all, 'list'] as const,
    list: (filters: Record<string, any>) =>
      [...queryKeys.shifts.lists(), filters] as const,
    details: () => [...queryKeys.shifts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.shifts.details(), id] as const,
    open: () => [...queryKeys.shifts.all, 'open'] as const,
  },

  // Reports
  reports: {
    all: ['reports'] as const,
    kpi: (filters: Record<string, any>) =>
      [...queryKeys.reports.all, 'kpi', filters] as const,
    topProducts: (filters: Record<string, any>) =>
      [...queryKeys.reports.all, 'topProducts', filters] as const,
    dailySummary: (filters: Record<string, any>) =>
      [...queryKeys.reports.all, 'dailySummary', filters] as const,
  },

  // Customers
  customers: {
    all: ['customers'] as const,
    lists: () => [...queryKeys.customers.all, 'list'] as const,
    list: (filters: Record<string, any>) =>
      [...queryKeys.customers.lists(), filters] as const,
    details: () => [...queryKeys.customers.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.customers.details(), id] as const,
  },

  // Inventory
  inventory: {
    all: ['inventory'] as const,
    summary: (filters: Record<string, any>) =>
      [...queryKeys.inventory.all, 'summary', filters] as const,
  },

  // Auth (placeholder for future)
  auth: {
    all: ['auth'] as const,
    user: () => [...queryKeys.auth.all, 'user'] as const,
  },
};
