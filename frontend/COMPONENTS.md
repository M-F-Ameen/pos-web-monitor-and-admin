# Component Library Documentation

## Overview

This document provides detailed documentation for all reusable components in the POS Monitor Dashboard.

## Components by Category

### Layout Components

#### DashboardLayout

Main layout component that wraps dashboard pages with sidebar and header.

**Location:** `src/components/layouts/DashboardLayout.tsx`

**Props:**
- `children: React.ReactNode` - Page content
- `pageTitle: string` - Page title displayed in header
- `pageSubtitle?: string` - Optional subtitle
- `onRefresh?: () => void` - Callback for refresh action
- `className?: string` - Optional CSS class

**Usage:**
```tsx
import { DashboardLayout } from '@/components';

export default function SalesPage() {
  return (
    <DashboardLayout
      pageTitle="المبيعات"
      pageSubtitle="قائمة جميع المبيعات"
      onRefresh={async () => {
        // Fetch fresh data
      }}
    >
      {/* Page content */}
    </DashboardLayout>
  );
}
```

#### Sidebar

Navigation sidebar with RTL support and responsive mobile behavior.

**Location:** `src/components/layouts/Sidebar.tsx`

**Props:**
- `isOpen?: boolean` - Control sidebar visibility (mobile)
- `onClose?: () => void` - Callback when sidebar should close
- `className?: string` - Optional CSS class

**Features:**
- Automatic navigation highlighting based on current route
- Mobile drawer behavior with overlay
- Desktop sticky positioning
- Arabic labels for all menu items

#### Header

Top header bar with title, refresh button, and user menu.

**Location:** `src/components/layouts/Header.tsx`

**Props:**
- `title: string` - Page title
- `subtitle?: string` - Optional subtitle
- `onRefresh?: () => void` - Refresh callback
- `onMenuClick?: () => void` - Mobile menu toggle callback
- `className?: string` - Optional CSS class

#### PageContainer

Wrapper component for page content with consistent padding.

**Location:** `src/components/layouts/PageContainer.tsx`

**Props:**
- `children: React.ReactNode` - Content
- `className?: string` - Optional CSS class

---

### UI Components

#### KPICard

Displays key performance indicators with value, label, and optional delta.

**Location:** `src/components/ui/KPICard.tsx`

**Props:**
- `label: string` - Card label
- `value: number | string` - Display value
- `variant?: 'positive' | 'negative' | 'neutral' | 'primary'` - Color variant
- `subtext?: string` - Additional text below value
- `delta?: number` - Percentage change
- `icon?: React.ReactNode` - Optional icon
- `isLoading?: boolean` - Loading state
- `isCurrency?: boolean` - Format as currency

**Usage:**
```tsx
import { KPICard } from '@/components';

<KPICard
  label="إجمالي المبيعات"
  value={45000}
  variant="positive"
  icon="💰"
  isCurrency
  delta={12.5}
  subtext="زيادة عن الأمس"
/>
```

#### DataTable

Generic table component with responsive mobile view.

**Location:** `src/components/ui/DataTable.tsx`

**Props:**
- `columns: TableColumn<T>[]` - Column definitions
- `data: T[]` - Table data
- `rowKey: keyof T` - Key for row identification
- `isLoading?: boolean` - Loading state
- `isEmpty?: boolean` - Empty state
- `onRowClick?: (row: T, index: number) => void` - Row click handler
- `striped?: boolean` - Striped rows
- `hoverable?: boolean` - Hover effect

**Column Definition:**
```tsx
interface TableColumn<T> {
  key: keyof T;
  label: string;
  width?: string;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}
```

**Usage:**
```tsx
import { DataTable } from '@/components';

<DataTable
  columns={[
    { key: 'name', label: 'اسم العميل' },
    { 
      key: 'totalSpent', 
      label: 'الإجمالي',
      render: (value) => formatCurrency(value)
    },
  ]}
  data={customers}
  rowKey="id"
  onRowClick={(customer) => console.log(customer)}
/>
```

#### StatusBadge

Displays status with appropriate colors and labels.

**Location:** `src/components/ui/StatusBadge.tsx`

**Props:**
- `status: string` - Status value
- `variant?: 'default' | 'outlined'` - Badge variant
- `className?: string` - Optional CSS class

**Supported Statuses:**
- `completed` - Green badge
- `pending` - Yellow badge
- `cancelled` - Red badge
- `open` - Green badge
- `closed` - Gray badge
- `in_progress` - Blue badge

#### Dialog

Modal dialog for displaying details or forms.

**Location:** `src/components/ui/Dialog.tsx`

**Props:**
- `isOpen: boolean` - Control visibility
- `onClose: () => void` - Close callback
- `title: string` - Dialog title
- `children: React.ReactNode` - Dialog content
- `size?: 'sm' | 'md' | 'lg'` - Dialog size
- `showCloseButton?: boolean` - Show close button

**Usage:**
```tsx
import { Dialog } from '@/components';

const [isOpen, setIsOpen] = useState(false);

<Dialog
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="تفاصيل المبيعة"
>
  <p>Dialog content</p>
</Dialog>
```

#### FilterBar

Reusable filter controls for tables and lists.

**Location:** `src/components/ui/FilterBar.tsx`

**Props:**
- `filters: FilterOption[]` - Filter definitions
- `onFilterChange: (filters: Record<string, any>) => void` - Change callback
- `onReset?: () => void` - Reset callback
- `className?: string` - Optional CSS class

**Filter Option:**
```tsx
interface FilterOption {
  id: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'daterange';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: any;
}
```

#### LoadingState, EmptyState, ErrorState

State display components.

**Location:** `src/components/ui/LoadingState.tsx`

**LoadingState Props:**
- `message?: string` - Loading message
- `rows?: number` - Number of skeleton rows
- `className?: string` - Optional CSS class

**EmptyState Props:**
- `title?: string` - Empty title
- `description?: string` - Description
- `icon?: React.ReactNode` - Icon element
- `action?: { label: string; onClick: () => void }` - Optional action button
- `className?: string` - Optional CSS class

**ErrorState Props:**
- `title?: string` - Error title
- `message?: string` - Error message
- `onRetry?: () => void` - Retry callback
- `className?: string` - Optional CSS class

#### ErrorBoundary

React error boundary component.

**Location:** `src/components/ui/ErrorBoundary.tsx`

**Props:**
- `children: React.ReactNode` - Child components
- `fallback?: (error: Error, reset: () => void) => React.ReactNode` - Custom error UI

**Usage:**
```tsx
import { ErrorBoundary } from '@/components';

<ErrorBoundary fallback={(error, reset) => (
  <div>
    <p>Error: {error.message}</p>
    <button onClick={reset}>Try Again</button>
  </div>
)}>
  <YourComponent />
</ErrorBoundary>
```

---

### Chart Components

#### SalesChart

Line or bar chart for displaying sales trends.

**Location:** `src/components/charts/Charts.tsx`

**Props:**
- `data: DataPoint[]` - Chart data
- `isLoading?: boolean` - Loading state
- `title?: string` - Chart title
- `type?: 'line' | 'bar'` - Chart type

**Data Structure:**
```tsx
interface DataPoint {
  name: string;
  value: number;
  [key: string]: any;
}
```

#### CashMovementChart

Line chart for cash flow visualization.

**Location:** `src/components/charts/Charts.tsx`

**Props:**
- `data: DataPoint[]` - Chart data (with `income` and `expenses` keys)
- `isLoading?: boolean` - Loading state
- `title?: string` - Chart title

#### TopProductsChart

Pie or bar chart for top products.

**Location:** `src/components/charts/Charts.tsx`

**Props:**
- `data: Array<{ name: string; value: number }>` - Chart data
- `isLoading?: boolean` - Loading state
- `title?: string` - Chart title
- `type?: 'pie' | 'bar'` - Chart type

#### ChartContainer

Wrapper component for charts with loading state.

**Location:** `src/components/charts/Charts.tsx`

**Props:**
- `title: string` - Container title
- `subtitle?: string` - Optional subtitle
- `isLoading?: boolean` - Loading state
- `children: React.ReactNode` - Chart element
- `className?: string` - Optional CSS class

---

## Utility Functions

### RTL Utilities

**Location:** `src/lib/rtl-utils.ts`

#### Formatting Functions

- `formatCurrency(value: number, currency?: string): string`
- `formatNumber(value: number, options?: Intl.NumberFormatOptions): string`
- `formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string`
- `formatTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string`
- `formatDateTime(date: Date | string): string`
- `formatPhoneNumber(phone: string): string`

#### Helper Functions

- `getDir(): 'rtl' | 'ltr'`
- `isRTL(): boolean`
- `getStatusLabel(status: string): string`
- `getStatusColor(status: string): string`
- `getValueColor(value: number, isInverted?: boolean): string`
- `getValueArrow(value: number, isInverted?: boolean): string`

### Common Utilities

**Location:** `src/lib/utils.ts`

- `cn(...inputs: ClassValue[]): string` - Merge CSS classes
- `debounce<T>(func: T, wait: number): (...args) => void`
- `throttle<T>(func: T, limit: number): (...args) => void`
- `sleep(ms: number): Promise<void>`
- `getUnique<T>(array: T[]): T[]`
- `groupBy<T>(array: T[], key: keyof T): Record<string | number, T[]>`
- `calculatePercentageChange(current: number, previous: number): number`
- `isEmpty(value: any): boolean`
- `deepClone<T>(obj: T): T`
- `truncate(text: string, length?: number): string`

---

## Responsive Design

All components are built mobile-first with Tailwind CSS breakpoints:

- **xs:** 480px
- **sm:** 640px (default mobile)
- **md:** 768px (tablet)
- **lg:** 1024px (desktop)
- **xl:** 1280px (large desktop)
- **2xl:** 1536px (extra large)

### Mobile Behaviors

- **Sidebar:** Converts to drawer on `md` and below
- **Tables:** Card view on mobile, table view on `md` and above
- **Grids:** 1 column on mobile, 2-4 columns on desktop
- **Buttons:** Touch-friendly 44px+ height on mobile

---

## Styling Guidelines

### Custom Tailwind Classes

In `src/styles/globals.css`:

- `.page-container` - Page padding
- `.page-title` - Page heading
- `.kpi-card` - KPI card styling
- `.table-container` - Table wrapper
- `.btn-primary`, `.btn-secondary` - Button styles
- `.status-badge` - Status badge styling
- `.grid-kpi`, `.grid-kpi-sm` - Responsive grids
- `.spinner` - Loading spinner

### Color Usage

```tsx
// Positive values
className="text-success-600" // Green

// Negative values
className="text-negative-600" // Red

// Primary accent
className="bg-accent-500" // Green button

// Primary headers
className="bg-primary-900 text-white" // Dark blue
```

---

## Custom Hooks

**Location:** `src/hooks/useQueries.ts`

All hooks follow TanStack Query pattern and include automatic caching/stale time management.

### Available Hooks

<!-- useOverview hook removed when Overview page was deleted -->
- `useSalesList(filters?)` - Fetch sales with optional filters
- `useSale(id)` - Fetch single sale
- `useReturnsList(filters?)` - Fetch returns
- `useReturn(id)` - Fetch single return
- `useTreasury(filters?)` - Fetch treasury transactions
- `useShiftsList(filters?)` - Fetch shifts
- `useOpenShifts()` - Fetch open shifts
- `useShift(id)` - Fetch single shift
- `useReports(filters?)` - Fetch reports
- `useCustomersList(filters?)` - Fetch customers
- `useCustomer(id)` - Fetch single customer

**Usage:**
```tsx
import { useSalesList } from '@/hooks/useQueries';

export default function SalesPage() {
  const { data, isLoading, error } = useSalesList({ 
    page: 1, 
    pageSize: 10 
  });

  return (
    <>
      {isLoading && <LoadingState />}
      {error && <ErrorState onRetry={() => refetch()} />}
      {data && <DataTable data={data.data} {...props} />}
    </>
  );
}
```

---

## Type Definitions

All data types are in `src/types/api.ts` with Zod schemas:

- `Sale`, `SalesList`
- `Return`, `ReturnsList`
- `Treasury`, `TreasuryTransaction`
- `Shift`, `ShiftsList`
- `Reports`, `ReportKPI`
- `Customer`, `CustomersList`
<!-- Overview type removed -->

---

## Best Practices

1. **Always wrap pages with ErrorBoundary**
   ```tsx
   <ErrorBoundary>
     <YourPage />
   </ErrorBoundary>
   ```

2. **Use DataTable for lists**
   - Provides mobile responsive card view
   - Row click handling
   - Loading/empty states

3. **Use Dialog for details**
   - Prevents page navigation
   - Maintains context
   - Mobile-friendly

4. **Format numbers with utilities**
   ```tsx
   import { formatCurrency, formatDate } from '@/lib/rtl-utils';
   
   <span>{formatCurrency(amount)}</span>
   ```

5. **Use KPICard for metrics**
   - Consistent styling
   - Color variants for meaning
   - Optional delta indicator

6. **Responsive CSS with Tailwind**
   ```tsx
   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
     {/* Mobile: 1 col, Tablet: 2 cols, Desktop: 4 cols */}
   </div>
   ```

---

## Component Examples

See `src/app/(dashboard)/` directory for complete page examples using all components together.
