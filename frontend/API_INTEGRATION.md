# API Integration Guide

This guide explains how to connect the POS Monitor Dashboard to a real backend API.

## Current Architecture

The dashboard is fully prepared for API integration with:

- ✅ API client structure (src/lib/api/client.ts)
- ✅ Query hooks with TanStack Query (src/hooks/useQueries.ts)
- ✅ Type definitions with Zod schemas (src/types/api.ts)
- ✅ Endpoint mapping (src/lib/api/client.ts)
- ✅ Error handling and loading states
- ✅ Automatic caching and stale time management

Currently, **all data is hardcoded in page components** for demonstration purposes. This guide walks through the migration to real APIs.

## Step 1: Configure API Base URL

Update `.env.local`:

```bash
# Before
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000

# After
NEXT_PUBLIC_API_BASE_URL=http://your-api.com/api
```

## Step 2: Implement API Endpoints

The endpoint structure is predefined in `src/lib/api/client.ts`. Update the fetch implementations:

### Example: Sales Endpoints

**File:** `src/lib/api/client.ts`

```typescript
export const endpoints = {
  // Current: placeholders
  sales: {
    list: '/sales',
    detail: (id: string) => `/sales/${id}`,
    create: '/sales',
  },
  // Add more as needed
};
```

## Step 3: Implement Query Hooks

**File:** `src/hooks/useQueries.ts`

### Sales List Hook

```typescript
export function useSalesList(filters?: Record<string, any>) {
  return useQuery<SalesList>({
    queryKey: queryKeys.sales.list(filters || {}),
    queryFn: async () => {
      const response = await apiClient.get<SalesList>(
        endpoints.sales.list,
        { params: filters }
      );
      // Response should match SalesList type
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  });
}
```

### Sales Detail Hook

```typescript
export function useSale(id: string) {
  return useQuery<Sale>({
    queryKey: queryKeys.sales.detail(id),
    queryFn: () =>
      apiClient.get<Sale>(endpoints.sales.detail(id)),
    enabled: !!id,
  });
}
```

## Step 4: Update Page Components

Remove hardcoded mock data and connect to real hooks.

### Before: Hardcoded Data

```typescript
'use client';

export default function SalesPage() {
  // Mock data hardcoded
  const mockSalesData: Sale[] = [
    { id: '1', receiptNumber: 'REC-001', ... },
    { id: '2', receiptNumber: 'REC-002', ... },
  ];

  return (
    <DataTable
      columns={[...]}
      data={mockSalesData}
      rowKey="id"
    />
  );
}
```

### After: Real API Data

```typescript
'use client';

import { useSalesList } from '@/hooks/useQueries';
import { LoadingState, ErrorState } from '@/components';

export default function SalesPage() {
  const { data, isLoading, error, refetch } = useSalesList();

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <DataTable
      columns={[...]}
      data={data.data} // API response structure
      rowKey="id"
    />
  );
}
```

## API Response Format

The dashboard expects responses to match these types (defined in `src/types/api.ts`):

### Paginated List Response

```typescript
interface ListResponse<T> {
  data: T[];        // Array of items
  total: number;    // Total count
  count: number;    // Items in this page
  page: number;     // Current page
  pageSize: number; // Items per page
}
```

### Error Response

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}
```

### Success Response

```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}
```

## API Endpoints Overview

All endpoints are predefined. Implement them on your backend to match this structure:

### Authentication
- `POST /auth/login` - Login and get JWT token
- `POST /auth/logout` - Logout
- `GET /auth/user` - Get current user profile

### Sales
- `GET /sales` - List sales (paginated, filterable)
- `GET /sales/:id` - Get sale details
- `POST /sales` - Create new sale (future)
- `PUT /sales/:id` - Update sale (future)
- `DELETE /sales/:id` - Delete sale (future)

### Returns
- `GET /returns` - List returns (paginated, filterable)
- `GET /returns/:id` - Get return details
- `POST /returns` - Create return (future)

### Treasury
- `GET /treasury` - List transactions
- `GET /treasury/summary` - Treasury summary (cash, income, expenses)
- `POST /treasury` - Create transaction (future)

### Shifts
- `GET /shifts` - List shifts
- `GET /shifts/:id` - Get shift details
- `GET /shifts/open` - Get open shifts only
- `POST /shifts/open` - Open new shift (future)
- `PUT /shifts/:id/close` - Close shift (future)

### Reports
- `GET /reports/summary` - Overview metrics (sales, returns, revenue)
- `GET /reports/sales-trend` - Sales trend (daily, weekly, monthly)
- `GET /reports/top-products` - Top products by sales
- `GET /reports/daily-summary` - Daily summary report

### Customers
- `GET /customers` - List customers (paginated, filterable)
- `GET /customers/:id` - Get customer details
- `POST /customers` - Create customer (future)
- `PUT /customers/:id` - Update customer (future)

<!-- Overview endpoint removed: the overview page was deleted -->

## Query Key Factory

Query keys are generated using a factory pattern for consistency:

```typescript
// src/lib/queryKeys.ts

export const queryKeys = {
  sales: {
    all: ['sales'],
    list: (filters: Record<string, any>) => [...queryKeys.sales.all, 'list', filters],
    detail: (id: string) => [...queryKeys.sales.all, 'detail', id],
  },
  // Similar for other entities...
};
```

This enables smart cache invalidation:

```typescript
// Invalidate all sales queries
await queryClient.invalidateQueries({ 
  queryKey: queryKeys.sales.all 
});

// Invalidate specific sale
await queryClient.invalidateQueries({
  queryKey: queryKeys.sales.detail(id)
});
```

## Error Handling

The API client automatically handles errors:

```typescript
// Automatic retry on 5xx errors
const response = await apiClient.get(url);

// Handle in components
const { data, error, isError } = useSalesList();

if (isError) {
  return <ErrorState onRetry={() => refetch()} />;
}
```

## Filtering & Pagination

Query hooks support filters through the first parameter:

```typescript
// With pagination and filters
const { data } = useSalesList({
  page: 1,
  pageSize: 10,
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  paymentMethod: 'CASH',
  cashier: 'Ahmed',
});

// Page/pageSize are handled by API
// Other filters are passed as query params
```

## Caching Strategy

TanStack Query is configured with optimal cache settings:

```typescript
// src/lib/queryClient.ts

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutes
      gcTime: 10 * 60 * 1000,        // 10 minutes
      retry: 1,                        // Retry once on error
      refetchOnWindowFocus: true,      // Refetch on tab focus
    },
  },
});
```

Customize per-hook if needed:

```typescript
export function useSalesList(filters?: Record<string, any>) {
  return useQuery({
    queryKey: queryKeys.sales.list(filters || {}),
    queryFn: () => apiClient.get(endpoints.sales.list, { params: filters }),
    staleTime: 1 * 60 * 1000,  // 1 minute for frequently-changing data
  });
}
```

## Mutations (Future)

When adding mutations (Create/Update/Delete):

```typescript
import { useMutation } from '@tanstack/react-query';

export function useCreateSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newSale: CreateSaleInput) =>
      apiClient.post(endpoints.sales.create, newSale),
    onSuccess: (data) => {
      // Update cache
      queryClient.setQueryData(
        queryKeys.sales.detail(data.id),
        data
      );
      // Invalidate list to refetch
      queryClient.invalidateQueries({
        queryKey: queryKeys.sales.all,
      });
    },
  });
}
```

## Testing the Integration

1. **Verify API is reachable:**

```bash
curl http://your-api.com/api/sales
```

2. **Check response format** matches expected types

3. **Test in development:**

```bash
npm run dev
# Navigate to sales page
# Check Network tab in DevTools
# Verify data loads
```

4. **Check console** for TypeScript errors or warnings

## Common Issues & Solutions

### Issue: "Failed to fetch" / CORS errors

**Solution:** Ensure API server has CORS enabled

```typescript
// API server (Express example)
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
```

### Issue: Data not updating

**Solution:** Check cache settings or manually refresh

```typescript
// In component
const { refetch } = useSalesList();

<button onClick={() => refetch()}>
  Refresh Data
</button>
```

### Issue: Types don't match

**Solution:** Update Zod schemas in `src/types/api.ts` to match API response

```typescript
export const SaleSchema = z.object({
  id: z.string(),
  receiptNumber: z.string(),
  // Add/update fields to match API
});
```

## Monitoring & Debugging

### Enable query debugging

Add this to root layout:

```tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<ReactQueryDevtools initialIsOpen={false} />
```

Then click the TanStack Query icon in the corner to inspect:
- Query status (idle, pending, success, error)
- Data and error messages
- Stale/Fresh status
- Cache timestamps

## Performance Tips

1. **Pagination** - Use for large lists
2. **Filtering** - Let API filter, not frontend
3. **Selective refetch** - Don't refetch everything
4. **Background sync** - Refetch on window focus
5. **Debouncing** - Debounce search/filter inputs

Example debounced search:

```tsx
import { useMemo } from 'react';
import { debounce } from '@/lib/utils';

export function SalesPage() {
  const [search, setSearch] = useState('');

  const debouncedFetch = useMemo(
    () => debounce((value: string) => {
      // Fetch with search term
    }, 300),
    []
  );

  return (
    <input
      onChange={(e) => {
        setSearch(e.target.value);
        debouncedFetch(e.target.value);
      }}
    />
  );
}
```

## Next Steps

1. Start with simple endpoints (Customers)
2. Test data fetching works correctly
3. Handle errors and edge cases
4. Add loading and empty states
5. Test filtering and pagination
6. Move to complex endpoints (Treasury, Reports)
7. Add mutations for CRUD operations

Good luck! 🚀
