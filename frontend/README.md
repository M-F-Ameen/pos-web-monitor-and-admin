# POS Monitor Dashboard - Owner Dashboard Frontend

A comprehensive Next.js 15+ owner dashboard for monitoring POS operations with real-time sales, returns, treasury, shifts, reports, and customer management.

## Features

- 📊 Real-time sales monitoring with receipt viewing
- 💰 Comprehensive treasury and cash management
- 👥 Customer management with debt tracking
- 📈 Advanced reporting with charts and analytics
- 🔄 Return management and processing
- ⏰ Shift tracking and analytics
- 🌐 Full RTL (Right-to-Left) Arabic support
- 📱 Fully responsive mobile-first design
- ♿ Accessible components

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS with RTL support
- **TanStack Query** - Server state management
- **Recharts** - Chart library for visualizations
- **Zod** - Schema validation

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                  # Auth route group
│   │   └── login/
│   │       └── page.tsx         # Login page
│   ├── (dashboard)/             # Dashboard route group
│   │   ├── layout.tsx           # Dashboard layout
│   │   ├── page.tsx
│   │   ├── sales/
│   │   │   └── page.tsx
│   │   ├── returns/
│   │   │   └── page.tsx
│   │   ├── treasury/
│   │   │   └── page.tsx
│   │   ├── shifts/
│   │   │   └── page.tsx
│   │   ├── reports/
│   │   │   └── page.tsx
│   │   └── customers/
│   │       └── page.tsx
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Root redirect
│   ├── providers.tsx            # TanStack Query provider
│   └── globals.css              # Global styles
├── components/                  # Reusable components
│   ├── layouts/                 # Layout components
│   │   ├── DashboardLayout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── PageContainer.tsx
│   ├── ui/                      # UI components
│   │   ├── KPICard.tsx
│   │   ├── DataTable.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── LoadingState.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ErrorState.tsx
│   │   └── Dialog.tsx
│   ├── charts/                  # Chart components
│   │   ├── SalesChart.tsx
│   │   └── CashMovementChart.tsx
│   └── features/                # Feature-specific components
│       ├── sales/
│       ├── returns/
│       ├── treasury/
│       ├── shifts/
│       ├── reports/
│       └── customers/
├── features/                    # Feature-specific logic
│   └── [feature]/              # Each feature folder
├── hooks/                       # Custom React hooks
├── lib/                         # Utilities and helpers
│   ├── api/
│   │   └── client.ts           # API client
│   ├── queryClient.ts          # TanStack Query setup
│   ├── queryKeys.ts            # Query key factory
│   ├── rtl-utils.ts            # RTL helpers
│   └── utils.ts                # Common utilities
├── types/                       # TypeScript type definitions
│   └── api.ts                  # API types and schemas
└── styles/
    └── globals.css             # Global CSS
```

## Color Scheme (Tager Branding)

- **Primary Dark Blue**: `#001F5C` - Headers, sidebar, main UI
- **Accent Green**: `#2AB92A` - Buttons, highlights, CTAs
- **Success Green**: `#00C853` - Positive states
- **Negative Red**: `#E74C3C` - Errors, returns
- **Text Dark**: `#1A1A1A` - Main text
- **Border Light**: `#E8E8E8` - Borders
- **Background**: `#FFFFFF` - White

## Getting Started

### Prerequisites

- Node.js 18+ (recommended 20+)
- npm, yarn, pnpm, or bun

### Quick Start

1. **Install dependencies:**

```bash
npm install
# or
yarn install
# or
pnpm install
```

2. **Start development server:**

```bash
npm run dev
# or
yarn dev
```

3. **Open browser:**

Navigate to [http://localhost:3000](http://localhost:3000)

The app will redirect to login page. Click "تسجيل الدخول" to access the dashboard (no auth required in v1).

### Key Pages

- `/` - Redirects to login
- `/login` - Login page (mock auth)
-- `/dashboard` - Dashboard root
- `/dashboard/sales` - Sales transactions
- `/dashboard/returns` - Return management
- `/dashboard/treasury` - Cash management
- `/dashboard/shifts` - Shift tracking
- `/dashboard/reports` - Analytics & reports
- `/dashboard/customers` - Customer management

## Development

### Running in Development Mode

```bash
npm run dev
```

Server runs at `http://localhost:3000`

### Building for Production

```bash
npm run build
npm start
```

### Code Quality

```bash
npm run lint
```

### File Structure

The dashboard follows a feature-based folder structure:

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/login/            # Login page
│   ├── (dashboard)/             # Dashboard pages
│   │   ├── layout.tsx           # Dashboard layout wrapper
│   │   ├── page.tsx
│   │   ├── sales/page.tsx       # Sales
│   │   ├── returns/page.tsx     # Returns
│   │   ├── treasury/page.tsx    # Treasury
│   │   ├── shifts/page.tsx      # Shifts
│   │   ├── reports/page.tsx     # Reports
│   │   └── customers/page.tsx   # Customers
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Root redirect
│   └── providers.tsx            # TanStack Query provider
├── components/                  # Reusable components
│   ├── layouts/                 # Layout components
│   ├── ui/                      # UI components
│   ├── charts/                  # Chart components
│   └── index.ts                 # Barrel exports
├── hooks/                       # Custom React hooks
│   └── useQueries.ts           # Data fetching hooks
├── lib/                         # Utilities
│   ├── api/client.ts           # HTTP client
│   ├── queryClient.ts          # TanStack Query setup
│   ├── queryKeys.ts            # Query key factory
│   ├── rtl-utils.ts            # RTL helpers
│   └── utils.ts                # Common utilities
├── styles/                      # Global styles
│   └── globals.css             # Tailwind + custom CSS
└── types/                       # TypeScript definitions
    └── api.ts                  # API types & Zod schemas
```

## RTL Support

This dashboard is built with RTL (Right-to-Left) as the primary direction for Arabic support:

- **Logical Properties**: Uses `ps-` (padding-start), `ms-` (margin-start) instead of `pl-`, `ml-`
- **Text Direction**: Set to RTL by default in HTML
- **Fonts**: Cairo font for Arabic typography
- **Utilities**: RTL helper functions in `lib/rtl-utils.ts`

## Styling & Components

### Tailwind CSS with RTL

The project uses Tailwind CSS with `tailwindcss-rtl` plugin for automatic RTL support:

```tsx
// Logical properties work automatically
<div className="ps-4">  {/* padding-right in RTL, padding-left in LTR */}
  Content
</div>
```

### Custom CSS Classes

Defined in `src/styles/globals.css`:

```tsx
// Responsive grid
<div className="grid-kpi">  {/* 1 col mobile, 2 tablet, 4 desktop */}</div>

// Button styles
<button className="btn-primary">Action</button>
<button className="btn-secondary">Cancel</button>

// Status badges
<div className="status-badge status-completed">مكتمل</div>
```

### Tager Color Scheme

```css
--color-primary-dark: #001F5C;  /* Headers, sidebar */
--color-accent-green: #2AB92A;  /* Buttons, highlights */
--color-success: #00C853;       /* Positive states */
--color-negative: #E74C3C;      /* Errors, negatives */
--color-text-primary: #1A1A1A;
--color-border: #E8E8E8;
```

## API Integration

The app is fully prepared for backend integration. All endpoints are mapped in `src/lib/api/client.ts`.

### Current State

- ✅ API client structure ready
- ✅ TanStack Query setup with caching
- ✅ Query key factory pattern
- ✅ Type definitions with Zod schemas
- ✅ Endpoint mapping (comments only)
- ❌ No mock API server (UI structure only)

### Connecting to Real Backend

1. **Update API base URL** in `.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://your-api.com/api
```

2. **Implement API calls** in `src/hooks/useQueries.ts`:

```tsx
export function useSalesList(filters?: Record<string, any>) {
  return useQuery<SalesList>({
    queryKey: queryKeys.sales.list(filters || {}),
    queryFn: () =>
      apiClient.get<SalesList>(endpoints.sales.list, { params: filters }),
  });
}
```

3. **Connect component** to data fetching:

```tsx
import { useSalesList } from '@/hooks/useQueries';

export default function SalesPage() {
  const { data, isLoading, error } = useSalesList();

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState onRetry={() => refetch()} />;
  
  return <DataTable data={data.data} {...props} />;
}
```

### Expected API Response Format

```json
{
  "success": true,
  "data": {
    "data": [/* items */],
    "total": 100,
    "count": 10,
    "page": 1,
    "pageSize": 10
  },
  "message": "Success"
}
```

### API Endpoints Reference

All endpoints are predefined in `endpoints` object:

- `GET /sales` - List sales
- `GET /sales/:id` - Get sale details
- `GET /returns` - List returns
- `GET /returns/:id` - Get return details
- `GET /treasury` - Treasury transactions
- `GET /treasury/summary` - Treasury summary
- `GET /shifts` - List shifts
- `GET /shifts/:id` - Get shift details
- `GET /shifts/open` - Get open shifts
- `GET /reports/summary` - Reports summary
- `GET /reports/top-products` - Top products
- `GET /reports/daily-summary` - Daily summary
- `GET /customers` - List customers
-- `GET /customers/:id` - Get customer details
- `POST /auth/login` - Login (placeholder)
- `POST /auth/logout` - Logout (placeholder)
- `GET /auth/user` - Get current user (placeholder)

## Implementation Highlights

### UI/UX Features

- **RTL/Arabic First**: Proper right-to-left layout with Cairo font
- **Dark Blue & Green Theme**: Tager branding colors throughout
- **Responsive Tables**: Desktop table view, mobile card view
- **Data Visualization**: Charts with Recharts (Tager colors)
- **Loading States**: Skeleton loaders on all async operations
- **Empty States**: Helpful messages when no data available
- **Error Boundaries**: Graceful error handling with retry options
- **Modal Dialogs**: Detailed views for sales, returns, shifts, customers

### Architecture

- **Server Components**: Next.js layouts and static pages
- **Client Components**: Interactive elements (forms, dialogs, charts)
- **Query Layer**: TanStack Query with automatic caching
- **Type Safety**: Full TypeScript + Zod schema validation
- **Component Library**: 20+ reusable components
- **Hooks**: 10+ custom hooks for data fetching
- **Utils**: RTL helpers, formatters, common utilities

### Mobile Optimization

- **Touch-Friendly**: 44px+ button sizes
- **Responsive Breakpoints**: xs(480) → sm(640) → md(768) → lg(1024) → xl(1280)
- **Adaptive Navigation**: Sidebar drawer on mobile, permanent on desktop
- **Safe Area Support**: Support for notches and home indicators
- **Fast Loading**: CSS optimization, code splitting, image optimization

## Responsive Design

- **Mobile (< 640px)**: Single column, stacked layout
- **Tablet (640px - 1024px)**: 2-column grid, sidebar drawer
- **Desktop (> 1024px)**: Full multi-column layout, permanent sidebar

## Performance

- **Code Splitting**: Automatic with Next.js App Router
- **Image Optimization**: Next.js Image component
- **Caching**: TanStack Query with smart stale time
- **Bundle Size**: Optimized with tree-shaking

## Future Enhancements

- [ ] Dark mode toggle
- [ ] Multi-language support (English/Arabic)
- [ ] Real-time data with WebSockets
- [ ] Advanced filtering and search
- [ ] Export functionality (PDF, Excel)
- [ ] Custom date range selection
- [ ] User preferences and settings
- [ ] Notification system

## Testing & Quality Assurance

### Type Checking

```bash
# Validate all TypeScript files
npx tsc --noEmit
```

### Build Verification

```bash
# Test production build
npm run build

# Start production server
npm start
```

### Responsive Testing

Test the dashboard on multiple viewports:

- **Mobile:** 375px, 480px (iPhone SE, 14)
- **Tablet:** 768px, 1024px (iPad)
- **Desktop:** 1280px, 1920px, 2560px

**Testing Checklist:**

- [ ] Sidebar drawer opens/closes on mobile
- [ ] DataTable switches to card view on mobile
- [ ] KPI cards stack properly on small screens
- [ ] Buttons are touch-friendly (44px+ height)
- [ ] Text is readable at all screen sizes
- [ ] Charts are responsive with proper spacing
- [ ] Dialogs are fullscreen on mobile
- [ ] No horizontal scrolling on tables
- [ ] All images load correctly
- [ ] No layout shifts (CLS)

### Browser Compatibility

Tested and working on:

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari (iOS 14+)
- Chrome Mobile (Android 10+)

## Troubleshooting

### Common Issues

**1. Module not found errors**

```bash
# Clear build cache and reinstall
rm -rf .next node_modules package-lock.json
npm install
npm run dev
```

**2. Tailwind styles not applying**

```bash
# Reset Tailwind cache
npm run dev -- --reset

# Or manually clear
rm -rf .next
npm run dev
```

**3. Port 3000 already in use**

```bash
# Use different port
npm run dev -- -p 3001

# Or kill process
lsof -ti:3000 | xargs kill -9  # macOS/Linux
```

**4. Arabic text not displaying**

- Verify Cairo font is loaded: Check `src/app/layout.tsx`
- Check `.env.local` has `NEXT_PUBLIC_LOCALE=ar`
- Verify `html` element has `dir="rtl"` in root layout

**5. TypeScript errors**

```bash
# Check for type errors
npx tsc --noEmit

# Update types
npm install --save-dev @types/react@latest
```

## Completion Status

✅ **Phase 1 - Core Setup & Configuration**
- Next.js 15 with App Router
- TypeScript 5.3 (strict mode)
- Tailwind CSS with RTL plugin
- TanStack Query setup
- Zod schema validation
- Environment variables configured

✅ **Phase 2 - Component Library**
- 4 layout components (DashboardLayout, Sidebar, Header, PageContainer)
- 10 UI components (KPICard, DataTable, StatusBadge, Dialog, FilterBar, LoadingState, EmptyState, ErrorState, ErrorBoundary)
- 4 chart components (SalesChart, CashMovementChart, TopProductsChart, ChartContainer)
- Barrel export index

✅ **Phase 3 - Dashboard Layout & Navigation**
- Route groups setup ((auth), (dashboard))
- Root layout with RTL, Cairo font, providers
- Login page (mock auth)
- Dashboard layout with responsive sidebar
- Header with refresh button and user menu

✅ **Phase 4 - Dashboard Pages (7 pages)**
1. Sales - Transaction listing, filtering, details dialog
2. Returns - Return management, refund tracking
3. Treasury - Cash movement, operations, balance
4. Shifts - Shift tracking, employee records
5. Reports - Analytics, charts, daily summary
6. Customers - Customer management, debt tracking

Each page includes:
- KPI cards with proper formatting
- Data tables (responsive desktop/mobile)
- Filters and search
- Detail dialogs
- Charts (where applicable)
- Mock data
- Error boundaries
- Full RTL support

✅ **Phase 5 - Responsive Design**
- Mobile-first approach throughout
- Touch-friendly components (44px+ minimum)
- Responsive breakpoints (xs, sm, md, lg, xl, 2xl)
- Sidebar drawer on mobile
- Table card view on mobile
- Adaptive grids and layouts
- Safe area support for notches

✅ **Phase 6 - API Integration Setup & Documentation**
- API client structure ready (src/lib/api/client.ts)
- Query key factory pattern implemented
- 10+ custom hooks for data fetching
- Zod schemas for all data types
- Endpoint mapping for all endpoints
- Comprehensive component documentation (COMPONENTS.md)
- Complete README with examples

## What's Ready for Next Steps

### Ready to Connect Backend

All infrastructure is in place to connect a real API:

1. **Query hooks ready** - Just implement the API calls
2. **Type definitions complete** - Zod schemas for validation
3. **Error handling** - Loading, error, and empty states
4. **Caching strategy** - TanStack Query with smart stale times
5. **Endpoint mapping** - All endpoints predefined

### Example Backend Integration

```tsx
// Before: Placeholder hook
export function useSalesList() {
  return { data: mockData, isLoading: false };
}

// After: Real API hook
export function useSalesList(filters?: Record<string, any>) {
  return useQuery({
    queryKey: queryKeys.sales.list(filters || {}),
    queryFn: () =>
      apiClient.get<SalesList>(endpoints.sales.list, { params: filters }),
  });
}
```

Then update components to use real hooks instead of mock data.

### Ready for Deployment

```bash
# Build for production
npm run build

# Deploy to Vercel, Netlify, or self-hosted
npm start
```

## Next Steps

1. **Connect to Backend**
   - Update `NEXT_PUBLIC_API_BASE_URL` in `.env.local`
   - Implement real API calls in `useQueries.ts` hooks
   - Test with actual data

2. **Add Authentication**
   - Implement real login in `src/app/login/page.tsx`
   - Add JWT token storage and refresh logic
   - Protect routes with middleware

3. **Add More Features**
   - Export functionality (PDF, Excel)
   - Advanced filtering and search
   - Real-time notifications
   - Dark mode toggle
   - User preferences

4. **Testing**
   - Add unit tests for utilities
   - Add component tests with Testing Library
   - Add E2E tests with Cypress/Playwright

5. **Monitoring**
   - Add error tracking (Sentry)
   - Add analytics (Google Analytics, Mixpanel)
   - Add performance monitoring

## License

Copyright © 2024. All rights reserved.

## Support

For issues or questions, please contact the development team.
