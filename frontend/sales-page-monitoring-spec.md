# Sales Page Monitoring Spec

## Page Name

`المبيعات`

Route:

`/sales`

## Page Goal

This page is for the shop owner to monitor sales in real time in a simple and clear way.

The page is read-only.

The owner should be able to:

- see current sales activity quickly
- understand how much was sold today
- understand sales for each `وردية`
- know who made each sale
- open any sale and inspect full details
- press a receipt icon and view the receipt
- watch new sales appear without refreshing manually

## Important Rules

- do not include payment method monitoring details on this page
- do not include export in v1
- focus only on monitoring sales activity and receipt visibility

## Main Page Structure

The page should be built in this order from top to bottom:

1. page header
2. live status and last update area
3. KPI summary cards
4. shift summary strip
5. filters bar
6. sales table
7. sale details drawer or modal
8. receipt preview modal

The page should stay simple and focused.

## 1. Page Header

The top of the page should contain:

- page title: `المبيعات`
- short subtitle: `متابعة المبيعات المباشرة وحركة الفواتير`
- refresh button

### Header Purpose

This area tells the owner where they are and gives one clear action:

- refresh data now

## 2. Live Status Area

Directly under the header, show a small status row.

It should contain:

- live status badge
- last updated time
- optional freshness note

### Status Examples

- `متصل`
- `يتم التحديث`
- `آخر تحديث منذ 10 ثوان`
- `البيانات متأخرة`

### Purpose

The owner must always know if the page is really live or if the data is delayed.

## 3. KPI Summary Cards

Show a compact row or grid of KPI cards.

These are the most important numbers on the page.

### Required Cards

1. `إجمالي مبيعات اليوم`
2. `عدد الفواتير اليوم`
3. `متوسط قيمة الفاتورة`
4. `مبيعات الوردية الحالية`
5. `عدد فواتير الوردية الحالية`
6. `أعلى كاشير اليوم`

### Optional Good Additions

- `آخر فاتورة`

### KPI Card Rules

- keep the card simple
- label at top
- big number in middle
- optional small helper text below
- use green for positive totals

## 4. Shift Summary Strip

Below the KPI cards, add a simple section for monitoring sales by `وردية`.

This section should help the owner quickly compare shifts.

### Show

- current open shifts
- sales total for each shift
- invoice count for each shift
- active cashier count in each shift if available

### Display Style

This can be:

- small shift cards
- or a compact horizontal strip

### Example Shift Card Content

- shift name
- shift status
- total sales
- invoices count

## 5. Filters Bar

Below the shift summary, place a filters area.

The owner should be able to narrow the sales list quickly.

### Required Filters

- search input
- date range
- shift filter
- cashier filter
- status filter

### Search Should Support

- receipt number
- customer name
- cashier name

### Status Options

- `الكل`
- `مكتملة`
- `مسترجعة`
- `ملغية`

### Shift Filter Options

- `الكل`
- `الوردية الحالية`
- `ورديات اليوم`
- or a specific shift from backend data

### Filter Actions

- apply automatically on change
- reset filters button

### UX Rule

On mobile:

- filters should collapse into a sheet or accordion

On desktop:

- filters can appear in one visible row

## 6. Sales Table

This is the main content of the page.

The table should show recent and live sales records.

### Required Columns

1. receipt number
2. date
3. time
4. customer
5. cashier
6. shift
7. total
8. status
9. receipt
10. details

### Recommended Arabic Labels

- `رقم الفاتورة`
- `التاريخ`
- `الوقت`
- `العميل`
- `الكاشير`
- `الوردية`
- `الإجمالي`
- `الحالة`
- `الإيصال`
- `التفاصيل`

### Table Behavior

- newest sales first
- rows update when new sales arrive
- pagination is acceptable
- clicking details opens sale details
- clicking receipt icon opens receipt preview

### Status Badge Style

- completed: green
- refunded: red
- voided/cancelled: gray or amber

### Receipt Column

Each row should include a small receipt icon button.

When pressed:

- open the receipt preview
- show the invoice clearly in a modal or drawer

The owner should be able to inspect the receipt without leaving the page.

## 7. Sale Details Drawer

When the owner opens a sale, show a right-side drawer on desktop or bottom sheet on mobile.

This is the main detailed view for a sale.

### Drawer Sections

1. sale summary
2. items list
3. customer details
4. cashier details
5. shift details
6. sale status information
7. receipt quick action

## 7.1 Sale Summary Section

Show:

- receipt number
- sale date and time
- shift name or shift id
- sale status
- subtotal
- discount
- increase
- final total

## 7.2 Items List Section

Show all items inside the sale.

Each item row should include:

- product name
- quantity
- unit price
- line total

### Optional

- product code
- barcode

## 7.3 Customer Details Section

Show:

- customer name
- phone if available
- simple note if this was a guest sale

If there is no customer:

- show `عميل نقدي` or `بدون عميل`

## 7.4 Cashier Details Section

Show:

- cashier name
- cashier id if available

This is important because the owner is monitoring staff activity.

## 7.5 Shift Details Section

Show:

- shift name
- shift id if available
- shift login time if available

This is required because the owner wants to monitor sales by `وردية`.

## 7.6 Sale Status Section

Show:

- sale status
- if refunded, show refund note or refund relation when available
- if voided, show that clearly

## 7.7 Receipt Quick Action

Inside the details drawer, include:

- a receipt icon button
- or a button labeled `عرض الإيصال`

This should open the receipt preview modal.

## 8. Receipt Preview Modal

There must be a simple receipt preview view.

It should open when:

- the receipt icon in the table is pressed
- or the receipt action inside the details drawer is pressed

### Receipt Preview Should Show

- receipt number
- date/time
- customer
- cashier
- shift
- items
- subtotal
- discount
- increase
- total

### Purpose

The owner wants fast receipt visibility from the monitoring page.

## Realtime Behavior

This page is a monitoring page, so it must feel live.

### Required Realtime Rules

- refresh list automatically every `15` to `30` seconds
- allow manual refresh anytime
- show new sales at top
- keep current filters active during live updates
- keep shift grouping or shift filtering stable during updates

### Important UX Rule

Do not close the details drawer or receipt modal automatically when data refreshes.

## Loading State

Show:

- skeleton KPI cards
- skeleton shift summary cards
- skeleton table rows

Do not show an empty blank page while loading.

## Empty State

If no sales exist for current filters, show:

- simple empty illustration or icon
- message like `لا توجد مبيعات مطابقة حالياً`
- reset filters action

## Error State

If loading fails, show:

- clear error message
- retry button

Suggested message:

`تعذر تحميل بيانات المبيعات`

## Mobile Behavior

The page must still work well on phone.

### Mobile Rules

- KPI cards can be 2 per row
- shift summary can scroll horizontally
- filters inside collapsible section
- table can become stacked cards if needed
- details should open as full-screen sheet
- receipt preview should open cleanly on mobile
- refresh action should stay visible


## Minimum Data The Page Will Need

The frontend should expect the backend to provide data similar to this:

### Sales List Record

- id
- receiptNumber
- createdAt
- customerName
- cashierName
- shiftId
- shiftName
- subtotal
- discountAmount
- increaseAmount
- total
- status

### Sale Details Record

- all sales list fields
- items array
- customer object if available
- cashier object if available
- shift object if available

### KPI Summary

- totalSalesToday
- invoicesCountToday
- averageInvoiceValue
- currentShiftSales
- currentShiftInvoices
- topCashierToday
- lastUpdatedAt

### Shift Summary Data

- shiftId
- shiftName
- shiftStatus
- totalSales
- invoicesCount
- activeCashiersCount

## Implementation Priority

The page should be built in this order:

1. page layout
2. KPI cards
3. shift summary section
4. filters bar
5. sales table
6. sale details drawer
7. receipt preview modal
8. loading, empty, and error states
9. live refresh behavior

## Final Expected Result

When this page is finished, the owner should be able to open the app and immediately know:

- how much was sold today
- how many invoices were created
- how sales are distributed by `وردية`
- which cashier is making sales
- full details of any single sale
- view the receipt quickly from the table
- whether the page is currently showing fresh live data
