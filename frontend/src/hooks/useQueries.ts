import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { apiClient, endpoints } from '@/lib/api/client';
import {
  SalesList,
  ReturnsList,
  Treasury,
  ShiftsList,
  Reports,
  CustomersList,
  Overview,
  InventorySummary,
} from '@/types/api';

export function useOverview(options?: UseQueryOptions<Overview>) {
  return useQuery<Overview>({
    queryKey: queryKeys.overview.detail(),
    queryFn: () => apiClient.get<Overview>(endpoints.overview.summary),
    ...options,
  });
}

export function useSalesList(
  filters?: Record<string, any>,
  options?: UseQueryOptions<SalesList>
) {
  return useQuery<SalesList>({
    queryKey: queryKeys.sales.list(filters || {}),
    queryFn: () =>
      apiClient.get<SalesList>(endpoints.sales.list, { params: filters }),
    ...options,
  });
}

export function useSale(id: string, options?: UseQueryOptions<any>) {
  return useQuery({
    queryKey: queryKeys.sales.detail(id),
    queryFn: () => apiClient.get(endpoints.sales.detail(id)),
    ...options,
  });
}

export function useReturnsList(
  filters?: Record<string, any>,
  options?: UseQueryOptions<ReturnsList>
) {
  return useQuery<ReturnsList>({
    queryKey: queryKeys.returns.list(filters || {}),
    queryFn: () =>
      apiClient.get<ReturnsList>(endpoints.returns.list, { params: filters }),
    ...options,
  });
}

export function useReturn(id: string, options?: UseQueryOptions<any>) {
  return useQuery({
    queryKey: queryKeys.returns.detail(id),
    queryFn: () => apiClient.get(endpoints.returns.detail(id)),
    ...options,
  });
}

export function useTreasury(
  options?: UseQueryOptions<Treasury>
) {
  return useQuery<Treasury>({
    queryKey: queryKeys.treasury.summary(),
    queryFn: () =>
      apiClient.get<Treasury>(endpoints.treasury.summary),
    ...options,
  });
}

export function useShiftsList(
  filters?: Record<string, any>,
  options?: UseQueryOptions<ShiftsList>
) {
  return useQuery<ShiftsList>({
    queryKey: queryKeys.shifts.list(filters || {}),
    queryFn: () =>
      apiClient.get<ShiftsList>(endpoints.shifts.list, { params: filters }),
    ...options,
  });
}

export function useOpenShifts(options?: UseQueryOptions<ShiftsList>) {
  return useQuery<ShiftsList>({
    queryKey: queryKeys.shifts.open(),
    queryFn: () => apiClient.get<ShiftsList>(endpoints.shifts.open),
    ...options,
  });
}

export function useShift(id: string, options?: UseQueryOptions<any>) {
  return useQuery({
    queryKey: queryKeys.shifts.detail(id),
    queryFn: () => apiClient.get(endpoints.shifts.detail(id)),
    ...options,
  });
}

export function useReports(
  filters?: Record<string, any>,
  options?: UseQueryOptions<Reports>
) {
  return useQuery<Reports>({
    queryKey: queryKeys.reports.kpi(filters || {}),
    queryFn: () =>
      apiClient.get<Reports>(endpoints.reports.summary, { params: filters }),
    ...options,
  });
}

export function useCustomersList(
  filters?: Record<string, any>,
  options?: UseQueryOptions<CustomersList>
) {
  return useQuery<CustomersList>({
    queryKey: queryKeys.customers.list(filters || {}),
    queryFn: () =>
      apiClient.get<CustomersList>(endpoints.customers.list, {
        params: filters,
      }),
    ...options,
  });
}

export function useCustomer(id: string, options?: UseQueryOptions<any>) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => apiClient.get(endpoints.customers.detail(id)),
    ...options,
  });
}

export function useInventory(
  filters?: Record<string, any>,
  options?: UseQueryOptions<InventorySummary>
) {
  return useQuery<InventorySummary>({
    queryKey: queryKeys.inventory.summary(filters || {}),
    queryFn: () =>
      apiClient.get<InventorySummary>(endpoints.inventory.summary, {
        params: filters,
      }),
    ...options,
  });
}
