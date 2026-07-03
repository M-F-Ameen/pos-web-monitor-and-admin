# Quick Start Guide

Get up and running with the POS Monitor Dashboard in 5 minutes.

## Installation

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Open browser
open http://localhost:3000
```

That's it! The app is running.

## First Steps

1. **See the login page** - http://localhost:3000/login
   - Click "تسجيل الدخول" (Sign In)
   - No credentials needed (mock auth)

2. **Explore dashboard** - http://localhost:3000/dashboard/sales
  - Sales page with metrics
  - All pages available in the sidebar

3. **Check responsive** - Resize browser or use DevTools
   - Mobile (375px), Tablet (768px), Desktop (1280px)

## Common Commands

```bash
# Development
npm run dev              # Start dev server (port 3000)
npm run build          # Build for production
npm run lint           # Check code quality
npm start              # Run production build

# Type checking
npx tsc --noEmit      # Check TypeScript errors

# Testing
npm test              # Run tests (if added)
```

## Project Structure

```
src/
├── app/               # Pages and routes
├── components/        # React components
├── hooks/            # Custom hooks
├── lib/              # Utilities
├── types/            # TypeScript types
└── styles/           # CSS
```

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout (RTL, Cairo font) |
| `src/app/providers.tsx` | TanStack Query setup |
| `src/components/index.ts` | Component exports |
| `tailwind.config.js` | Tailwind CSS config |
| `.env.local` | Environment variables |

## Creating a New Page

```typescript
// src/app/(dashboard)/new-page/page.tsx
'use client';

import { DashboardLayout, PageContainer, KPICard } from '@/components';

export default function NewPage() {
  return (
    <DashboardLayout pageTitle="اسم الصفحة">
      <PageContainer>
        {/* Your content */}
        <KPICard label="Metric" value={100} variant="primary" />
      </PageContainer>
    </DashboardLayout>
  );
}
```

## Using Components

### KPICard
```tsx
import { KPICard } from '@/components';

<KPICard
  label="إجمالي المبيعات"
  value={15000}
  variant="positive"
  isCurrency
/>
```

### DataTable
```tsx
import { DataTable } from '@/components';

<DataTable
  columns={[
    { key: 'name', label: 'الاسم' },
    { key: 'amount', label: 'المبلغ', render: (v) => `${v} ر.س` },
  ]}
  data={items}
  rowKey="id"
/>
```

### Dialog
```tsx
const [isOpen, setIsOpen] = useState(false);

<Dialog isOpen={isOpen} onClose={() => setIsOpen(false)} title="التفاصيل">
  <p>Dialog content</p>
</Dialog>
```

## Formatting Data

```typescript
import { formatCurrency, formatDate, getStatusLabel } from '@/lib/rtl-utils';

// Format money
formatCurrency(15000)        // "15,000.00 ر.س"

// Format date
formatDate('2024-01-15')     // "15/01/2024"

// Status labels
getStatusLabel('completed')  // "مكتمل"
```

## Styling with Tailwind

```tsx
// Colors
<div className="text-primary-900">Header</div>
<div className="bg-accent-500 text-white">Button</div>

// Spacing
<div className="p-4 m-2">Content</div>

// Responsive
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
  {/* 1 col on mobile, 2 on tablet, 4 on desktop */}
</div>

// RTL Safe (logical properties)
<div className="ps-4">     {/* padding-right on RTL, padding-left on LTR */}</div>
<div className="ms-2">     {/* margin-right on RTL, margin-left on LTR */}</div>
```

## TypeScript Types

All data types are defined in `src/types/api.ts`:

```typescript
import { Sale, Customer, Shift } from '@/types/api';

const sale: Sale = {
  id: '1',
  receiptNumber: 'REC-001',
  // ... other fields
};
```

## Environment Variables

Edit `.env.local`:

```bash
# API endpoint
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api

# Locale (ar for Arabic)
NEXT_PUBLIC_LOCALE=ar
```

## Debugging

### 1. TypeScript Errors
```bash
npx tsc --noEmit
```

### 2. Console Logs
- Open DevTools (F12)
- Check Console tab for errors/warnings

### 3. Network Requests
- Open DevTools → Network tab
- Watch API calls (when connected to backend)

### 4. React DevTools
- Install React DevTools extension
- Inspect components, props, state

## Common Issues

**Q: Styles not applying?**
```bash
npm run dev -- --reset
```

**Q: Port 3000 in use?**
```bash
npm run dev -- -p 3001
```

**Q: Module not found?**
```bash
rm -rf .next node_modules
npm install
```

**Q: Arabic text not showing?**
- Check Cairo font in DevTools
- Verify `.env.local` has `NEXT_PUBLIC_LOCALE=ar`
- Check `src/app/layout.tsx` has `dir="rtl"`

## Next: Connect Backend

When ready to add real data:

1. Read [API_INTEGRATION.md](API_INTEGRATION.md)
2. Update `.env.local` with backend URL
3. Implement API calls in `src/hooks/useQueries.ts`
4. Remove mock data from pages
5. Test with real data

## More Resources

- [README.md](README.md) - Full documentation
- [COMPONENTS.md](COMPONENTS.md) - Component reference
- [API_INTEGRATION.md](API_INTEGRATION.md) - Backend setup
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Going live

---

**Happy coding!** 🚀

Questions? Check the docs above.
