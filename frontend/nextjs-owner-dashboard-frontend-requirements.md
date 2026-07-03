# Next.js Owner Dashboard Frontend Brief

## Goal

Build a **separate** responsive web dashboard in `Next.js` for the shop owner.

This app is **frontend only** and must be built as an independent project.

The developer building it should assume:

- no access to the Electron app
- no access to the desktop codebase
- no direct SQLite access
- data will come later from a backend API

The dashboard is **read-only ** in v1.

## Main Pages

- Build these pages:

- `/sales` `المبيعات`
- `/returns` `المرتجعات`
- `/treasury` `الخزينه`
- `/shifts` `الورديات`
- `/reports` `التقارير`
- `/customers` `العملاء`
- `/login`

## What Each Page Should Show

## 1. (removed) Overview

The owner summary page was removed from this project.

## 2. Sales

Show:

- KPI cards
- filters
- sales table
- sale details drawer or modal

Suggested table columns:

- receipt number
- date/time
- customer
- cashier
- payment method
- total
- status

## 3. Returns

Show:

- KPI cards
- filters
- returns table
- return details drawer or modal

Suggested table columns:

- return number
- date/time
- product name
- quantity
- refund amount
- reason
- status
- processed by

## 4. Treasury

Show:

- summary cards
- cash movement chart
- operations table

Suggested cards:

- total sales
- total returns
- total withdrawals
- total expenses
- current cash

Suggested table columns:

- date/time
- type
- name
- amount
- user
- source

## 5. Shifts

Show:

- open shifts summary
- shifts table
- shift details page or drawer

Suggested table columns:

- user
- role
- login time
- logout time
- status
- start cash
- end cash
- total sales
- total returns
- net cash

## 6. Reports

Show:

- KPI cards
- date range filter
- charts
- top products table
- daily summary table

Suggested KPIs:

- gross sales
- total refunds
- net revenue
- total orders
- sold units

## 7. Customers

Show:

- KPI cards
- filters
- customers table
- customer details drawer or modal

Suggested table columns:

- customer name
- phone
- total purchases
- total spent
- debt
- last activity

## Design Rules

- Arabic first
- RTL layout
- mobile friendly
- clean business dashboard style
- simple and clear, not decorative

Use:

- `Cairo` font
- strong table readability
- clear KPI cards
- green for positive money
- red for returns and negative money
- amber for warnings or stale data

## Frontend Tech Stack

Use:

- `Next.js`
- `TypeScript`
- `Tailwind CSS`
- `TanStack Query`
- `Recharts`
- `Zod`

## Simple Folder Structure

```text
owner-dashboard/
  src/
    app/
      login/
        page.tsx
      page.tsx
      sales/
        page.tsx
      returns/
        page.tsx
      treasury/
        page.tsx
      shifts/
        page.tsx
      reports/
        page.tsx
      customers/
        page.tsx
      layout.tsx
      globals.css
    components/
      ui/
      layout/
      charts/
    features/
      sales/
      returns/
      treasury/
      shifts/
      reports/
      customers/
      
      auth/
    lib/
      api/
      formatters/
      query/
      utils/
    types/
```

## Shared Components Needed

- sidebar
- top header
- page container
- KPI card
- data table
- filters bar
- drawer or modal
- loading state
- empty state
- error state
- status badge

## Data Assumption

The frontend must assume there will be API endpoints later.

Do not build any Electron-specific logic.

Assume the API will return data for:

- sales
- returns
- treasury
- shifts
- reports
- customers
 - reports
 - customers

## Frontend Rules

1. Keep pages simple.
2. Keep API calls outside page files.
3. Put each domain in its own `features/` folder.
4. Use reusable shared UI components.
5. Use server data with `TanStack Query`.
6. Support loading, empty, and error states on every page.
7. Make filters and tables easy to use on mobile.

## Minimum UX Requirements

Every page must have:

- page title
- refresh action
- filters
- main table or chart section
- loading state
- empty state
- error state

## Nice To Have

If time allows:

- live status badge
- last updated timestamp
- dark mode
- mobile drawer navigation

## Final Build Objective

The result should be a clean standalone owner dashboard frontend that:

- is easy to connect to a backend later
- does not depend on Electron
- supports Arabic RTL properly
- works well on phone and desktop
- is organized enough for future growth
