import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavSidebar } from "../../components/layout/NavSidebar";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { TablePagination } from "../../components/ui/TablePagination";
import {
  IconGrid,
  IconCart,
  IconBox,
  IconTag,
  IconReceipt,
  IconUndo,
  IconUsers,
  IconUser,
  IconBarcode,
  IconWallet,
  IconChartBar,
  IconSettings,
  IconRefresh,
  IconPrinter,
  IconClock,
} from "../../components/ui/Icons";
import type { NavItem } from "../../components/layout/NavSidebar";
import { canAccessPage, isAppPage, type AppPage } from "../../app/access";
import { useAuth } from "../../app/AuthContext";
import type { POSSettings } from "../../app/pos/types";
import {
  reports as reportsService,
  settings as settingsService,
} from "../../services/db";
import type { ReportsSummaryPayload } from "../../services/db";
import { printReportsSummaryReceipt } from "../../services/receiptPrinter";
import "./ReportsPage.css";

type ReportsSection = "overview" | "performance" | "risk";

const REPORT_TABLE_PAGE_SIZE = 8;

const DEFAULT_REPORT_SETTINGS: POSSettings = {
  storeName: "متجر التبغ",
  storeAddress: "",
  storePhone: "",
  currency: "LE",
  receiptFooter: "",
  receiptPrinterName: "",
};

const EMPTY_REPORTS_SUMMARY: ReportsSummaryPayload = {
  grossSales: 0,
  totalRefunds: 0,
  netRevenue: 0,
  totalOrders: 0,
  soldUnits: 0,
  inventoryUnits: 0,
  inventoryValue: 0,
  totalCustomerDebt: 0,
  debtCustomersCount: 0,
  topProducts: [],
  lowStockProducts: [],
  debtCustomers: [],
  dailyRows: [],
};

function toDateInputValue(date: Date): string {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function dateFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function toCurrency(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

function toDateLabel(value: string): string {
  if (!value) return "غير محدد";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("ar-EG");
}

function toDateTimeLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleString("ar-EG");
}

function paginateRows<T>(rows: T[], page: number, pageSize: number): T[] {
  const startIndex = (page - 1) * pageSize;
  return rows.slice(startIndex, startIndex + pageSize);
}

function buildNavItems(activeId: AppPage, role: string): NavItem[] {
  const pageItems: NavItem[] = [
    {
      id: "pos",
      icon: <IconCart />,
      label: "نقاط البيع",
      active: activeId === "pos",
    },
    {
      id: "inventory",
      icon: <IconBox />,
      label: "المخزون",
      active: activeId === "inventory",
    },
    {
      id: "categories",
      icon: <IconTag />,
      label: "التصنيفات",
      active: activeId === "categories",
    },
    {
      id: "sales",
      icon: <IconReceipt />,
      label: "المبيعات",
      active: activeId === "sales",
    },
    {
      id: "returns",
      icon: <IconUndo />,
      label: "المرتجعات",
      active: activeId === "returns",
    },
    {
      id: "users",
      icon: <IconUsers />,
      label: "المستخدمون",
      active: activeId === "users",
    },
    {
      id: "shifts",
      icon: <IconClock />,
      label: "الورديات",
      active: activeId === "shifts",
    },
    {
      id: "customers",
      icon: <IconUser />,
      label: "العملاء",
      active: activeId === "customers",
    },
    {
      id: "suppliers",
      icon: <IconBox />,
      label: "الموردون",
      active: activeId === "suppliers",
    },
    {
      id: "barcode",
      icon: <IconBarcode />,
      label: "الباركود",
      active: activeId === "barcode",
    },
    {
      id: "treasury",
      icon: <IconWallet />,
      label: "الخزينة",
      active: activeId === "treasury",
    },
    {
      id: "reports",
      icon: <IconChartBar />,
      label: "التقارير",
      active: activeId === "reports",
    },
    {
      id: "settings",
      icon: <IconSettings />,
      label: "الإعدادات",
      active: activeId === "settings",
    },
  ];

  return pageItems.filter(
    (item) => isAppPage(item.id) && canAccessPage(role as any, item.id),
  );
}

export function ReportsPage() {
  const navigate = useNavigate();
  const { role, logout } = useAuth();
  const [summary, setSummary] = useState<ReportsSummaryPayload>(
    EMPTY_REPORTS_SUMMARY,
  );
  const [posSettings, setPosSettings] = useState<POSSettings>(
    DEFAULT_REPORT_SETTINGS,
  );
  const [currency, setCurrency] = useState("LE");
  const [generatedAt, setGeneratedAt] = useState<string>(
    new Date().toISOString(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [printMessage, setPrintMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPrintingReport, setIsPrintingReport] = useState(false);
  const [activeSection, setActiveSection] = useState<ReportsSection>("overview");
  const [topProductsPage, setTopProductsPage] = useState(1);
  const [dailyRowsPage, setDailyRowsPage] = useState(1);
  const [debtCustomersPage, setDebtCustomersPage] = useState(1);
  const [lowStockPage, setLowStockPage] = useState(1);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const fromDate = dateFromToday(-29);
      const toDate = toDateInputValue(new Date());
      const [summaryPayload, settings] = await Promise.all([
        reportsService.getSummary({
          fromDate,
          toDate,
          topProductsLimit: 25,
          lowStockLimit: 25,
          debtCustomersLimit: 25,
          dailyRowsLimit: 31,
        }),
        settingsService.get(),
      ]);

      setSummary(summaryPayload);
      setCurrency(settings.currency || "LE");
      setPosSettings({
        storeName: settings.storeName || DEFAULT_REPORT_SETTINGS.storeName,
        storeAddress:
          settings.storeAddress || DEFAULT_REPORT_SETTINGS.storeAddress,
        storePhone: settings.storePhone || DEFAULT_REPORT_SETTINGS.storePhone,
        currency: settings.currency || DEFAULT_REPORT_SETTINGS.currency,
        receiptFooter:
          settings.receiptFooter || DEFAULT_REPORT_SETTINGS.receiptFooter,
        receiptPrinterName:
          settings.receiptPrinterName ||
          DEFAULT_REPORT_SETTINGS.receiptPrinterName,
      });
      setGeneratedAt(new Date().toISOString());
    } catch (loadError) {
      console.error("Failed to load reports data:", loadError);
      setError("تعذر تحميل بيانات التقارير. حاول مرة أخرى.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!printMessage) return;
    const timeoutId = window.setTimeout(() => setPrintMessage(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [printMessage]);

  const grossSales = summary.grossSales;
  const totalRefunds = summary.totalRefunds;
  const netRevenue = summary.netRevenue;
  const totalOrders = summary.totalOrders;
  const soldUnits = summary.soldUnits;
  const inventoryTotals = useMemo(
    () => ({
      units: summary.inventoryUnits,
      value: summary.inventoryValue,
    }),
    [summary.inventoryUnits, summary.inventoryValue],
  );
  const totalCustomerDebt = summary.totalCustomerDebt;
  const debtCustomersCount = summary.debtCustomersCount;
  const visibleTopProducts = summary.topProducts;
  const visibleLowStock = summary.lowStockProducts;
  const visibleDailyRows = summary.dailyRows;
  const visibleDebtCustomers = summary.debtCustomers;
  const topProductsTotalPages = Math.max(
    1,
    Math.ceil(visibleTopProducts.length / REPORT_TABLE_PAGE_SIZE),
  );
  const dailyRowsTotalPages = Math.max(
    1,
    Math.ceil(visibleDailyRows.length / REPORT_TABLE_PAGE_SIZE),
  );
  const debtCustomersTotalPages = Math.max(
    1,
    Math.ceil(visibleDebtCustomers.length / REPORT_TABLE_PAGE_SIZE),
  );
  const lowStockTotalPages = Math.max(
    1,
    Math.ceil(visibleLowStock.length / REPORT_TABLE_PAGE_SIZE),
  );
  const paginatedTopProducts = useMemo(
    () => paginateRows(visibleTopProducts, topProductsPage, REPORT_TABLE_PAGE_SIZE),
    [topProductsPage, visibleTopProducts],
  );
  const paginatedDailyRows = useMemo(
    () => paginateRows(visibleDailyRows, dailyRowsPage, REPORT_TABLE_PAGE_SIZE),
    [dailyRowsPage, visibleDailyRows],
  );
  const paginatedDebtCustomers = useMemo(
    () =>
      paginateRows(
        visibleDebtCustomers,
        debtCustomersPage,
        REPORT_TABLE_PAGE_SIZE,
      ),
    [debtCustomersPage, visibleDebtCustomers],
  );
  const paginatedLowStock = useMemo(
    () => paginateRows(visibleLowStock, lowStockPage, REPORT_TABLE_PAGE_SIZE),
    [lowStockPage, visibleLowStock],
  );

  const dateRangeLabel = useMemo(() => {
    const start = toDateLabel(dateFromToday(-29));
    const end = toDateLabel(toDateInputValue(new Date()));
    return `${start} - ${end}`;
  }, [generatedAt]);

  useEffect(() => {
    setTopProductsPage((current) => Math.min(current, topProductsTotalPages));
  }, [topProductsTotalPages]);

  useEffect(() => {
    setDailyRowsPage((current) => Math.min(current, dailyRowsTotalPages));
  }, [dailyRowsTotalPages]);

  useEffect(() => {
    setDebtCustomersPage((current) =>
      Math.min(current, debtCustomersTotalPages),
    );
  }, [debtCustomersTotalPages]);

  useEffect(() => {
    setLowStockPage((current) => Math.min(current, lowStockTotalPages));
  }, [lowStockTotalPages]);

  const handlePrint = useCallback(async () => {
    if (isPrintingReport) return;

    const printedAt = new Date().toISOString();
    setGeneratedAt(printedAt);
    setIsPrintingReport(true);
    setPrintMessage(null);

    try {
      const printResult = await printReportsSummaryReceipt(
        {
          reportRangeLabel: dateRangeLabel,
          printedAt,
          grossSales,
          totalRefunds,
          netRevenue,
          totalOrders,
          soldUnits,
          inventoryUnits: inventoryTotals.units,
          inventoryValue: inventoryTotals.value,
          totalCustomerDebt,
          debtCustomersCount,
          topProducts: visibleTopProducts.slice(0, 10).map((item) => ({
            name: item.name,
            soldQty: item.soldQty,
            returnedQty: item.returnedQty,
            netRevenue: item.netRevenue,
          })),
          lowStockProducts: visibleLowStock.slice(0, 10).map((item) => ({
            name: item.name,
            stock: item.stock,
            threshold: item.alertThreshold,
            stockValue: item.stockValue,
          })),
          debtCustomers: visibleDebtCustomers.slice(0, 10).map((item) => ({
            name: item.name,
            debt: item.debt,
          })),
          dailyRows: visibleDailyRows.slice(0, 10).map((row) => ({
            dateKey: row.dateKey,
            orders: row.orders,
            units: row.units,
            grossSales: row.grossSales,
            refunds: row.refunds,
            netRevenue: row.netRevenue,
          })),
        },
        {
          ...posSettings,
          currency,
        },
      );

      if (!printResult.success) {
        setPrintMessage({
          type: "error",
          text: "فشل طباعة تقرير التقارير.",
        });
        return;
      }

      if (printResult.warning) {
        setPrintMessage({
          type: "success",
          text: "تمت الطباعة بنجاح. راجع نافذة الطباعة في النظام.",
        });
      } else {
        setPrintMessage({
          type: "success",
          text: "تمت طباعة التقرير بنجاح.",
        });
      }
    } catch (printError) {
      console.error("Failed to print reports summary:", printError);
      setPrintMessage({
        type: "error",
        text: "فشل طباعة تقرير التقارير.",
      });
    } finally {
      setIsPrintingReport(false);
    }
  }, [
    currency,
    dateRangeLabel,
    debtCustomersCount,
    grossSales,
    inventoryTotals.units,
    inventoryTotals.value,
    isPrintingReport,
    netRevenue,
    posSettings,
    soldUnits,
    totalCustomerDebt,
    totalOrders,
    totalRefunds,
    visibleDailyRows,
    visibleDebtCustomers,
    visibleLowStock,
    visibleTopProducts,
  ]);

  return (
    <div className="reports-page">
      <NavSidebar
        items={buildNavItems("reports", role)}
        collapsed={false}
        topAction={
          <IconButton variant="accent" aria-label="القائمة الرئيسية">
            <IconGrid />
          </IconButton>
        }
        onItemClick={(id) => {
          if (isAppPage(id)) {
            navigate(`/${id}`);
          }
        }}
        onLogout={() => {
          logout();
          navigate("/login");
        }}
      />

      <main className="reports-page__main">
        <section className="reports-page__content">
          <header className="reports-toolbar">
            <div className="reports-toolbar__brand">
              <h1 className="reports-toolbar__title">التقارير</h1>
              <p className="reports-toolbar__subtitle">
                نطاق التقرير: {dateRangeLabel}
              </p>
              <p className="reports-toolbar__meta">
                آخر تحديث: {toDateTimeLabel(generatedAt)}
              </p>
            </div>

            <div className="reports-toolbar__actions reports-page__print-hide">
              <Button
                type="button"
                variant="secondary"
                icon={<IconRefresh />}
                onClick={() => {
                  void loadData();
                }}
              >
                تحديث
              </Button>
              <Button
                type="button"
                variant="primary"
                icon={<IconPrinter />}
                onClick={() => {
                  void handlePrint();
                }}
                loading={isPrintingReport}
                loadingText="جاري الطباعة..."
                disabled={isLoading || isPrintingReport}
              >
                طباعة
              </Button>
            </div>
          </header>

          <nav
            className="reports-sections-nav reports-page__print-hide"
            aria-label="أقسام التقارير"
          >
            <button
              type="button"
              className={`reports-sections-nav__button ${
                activeSection === "overview"
                  ? "reports-sections-nav__button--active"
                  : ""
              }`}
              onClick={() => setActiveSection("overview")}
            >
              الملخص العام
            </button>
            <button
              type="button"
              className={`reports-sections-nav__button ${
                activeSection === "performance"
                  ? "reports-sections-nav__button--active"
                  : ""
              }`}
              onClick={() => setActiveSection("performance")}
            >
              المبيعات والأداء
            </button>
            <button
              type="button"
              className={`reports-sections-nav__button ${
                activeSection === "risk"
                  ? "reports-sections-nav__button--active"
                  : ""
              }`}
              onClick={() => setActiveSection("risk")}
            >
              العملاء والمخزون
            </button>
          </nav>

          {error && <p className="reports-error">{error}</p>}
          {printMessage && (
            <p
              className={`reports-message reports-message--${printMessage.type}`}
            >
              {printMessage.text}
            </p>
          )}

          {isLoading ? (
            <p className="reports-loading">جاري تحميل بيانات التقارير...</p>
          ) : (
            <>
              {activeSection === "overview" && (
                <section className="reports-kpis" aria-label="مؤشرات الملخص العام">
                  <article className="reports-kpi-card reports-kpi-card--accent">
                    <span className="reports-kpi-card__label">صافي الإيراد</span>
                    <strong className="reports-kpi-card__value">
                      {toCurrency(netRevenue, currency)}
                    </strong>
                  </article>
                  <article className="reports-kpi-card">
                    <span className="reports-kpi-card__label">إجمالي المبيعات</span>
                    <strong className="reports-kpi-card__value">
                      {toCurrency(grossSales, currency)}
                    </strong>
                  </article>
                  <article className="reports-kpi-card">
                    <span className="reports-kpi-card__label">إجمالي المرتجعات</span>
                    <strong className="reports-kpi-card__value reports-kpi-card__value--danger">
                      {toCurrency(totalRefunds, currency)}
                    </strong>
                  </article>
                  <article className="reports-kpi-card">
                    <span className="reports-kpi-card__label">عدد الطلبات</span>
                    <strong className="reports-kpi-card__value">{totalOrders}</strong>
                  </article>
                  <article className="reports-kpi-card">
                    <span className="reports-kpi-card__label">الوحدات المباعة</span>
                    <strong className="reports-kpi-card__value">{soldUnits}</strong>
                  </article>
                  <article className="reports-kpi-card">
                    <span className="reports-kpi-card__label">قيمة المخزون</span>
                    <strong className="reports-kpi-card__value">
                      {toCurrency(inventoryTotals.value, currency)}
                    </strong>
                  </article>
                  <article className="reports-kpi-card">
                    <span className="reports-kpi-card__label">إجمالي مديونية العملاء</span>
                    <strong className="reports-kpi-card__value reports-kpi-card__value--danger">
                      {toCurrency(totalCustomerDebt, currency)}
                    </strong>
                  </article>
                  <article className="reports-kpi-card">
                    <span className="reports-kpi-card__label">العملاء المدينون</span>
                    <strong className="reports-kpi-card__value">
                      {debtCustomersCount}
                    </strong>
                  </article>
                </section>
              )}

              {activeSection === "performance" && (
                <section className="reports-layout">
                  <article className="reports-panel reports-panel--span-2">
                    <header className="reports-panel__header">
                      <h2>الأصناف الأعلى مبيعًا</h2>
                    </header>
                    {visibleTopProducts.length === 0 ? (
                      <p className="reports-panel__empty">
                        لا توجد بيانات أصناف ضمن هذه الفترة.
                      </p>
                    ) : (
                      <>
                        <div className="reports-panel__scroll">
                          <table className="reports-table reports-table--wide">
                            <thead>
                              <tr>
                                <th>الصنف</th>
                                <th>التصنيف</th>
                                <th>مبيع</th>
                                <th>مرتجع</th>
                                <th>قيمة المبيعات</th>
                                <th>قيمة المرتجعات</th>
                                <th>صافي الإيراد</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedTopProducts.map((item) => (
                                <tr key={item.key}>
                                  <td>{item.name}</td>
                                  <td>{item.category}</td>
                                  <td>{item.soldQty}</td>
                                  <td>{item.returnedQty}</td>
                                  <td>{toCurrency(item.salesAmount, currency)}</td>
                                  <td>{toCurrency(item.refundAmount, currency)}</td>
                                  <td>{toCurrency(item.netRevenue, currency)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <TablePagination
                          currentPage={topProductsPage}
                          totalPages={topProductsTotalPages}
                          onPageChange={setTopProductsPage}
                        />
                      </>
                    )}
                  </article>

                  <article className="reports-panel reports-panel--span-2">
                    <header className="reports-panel__header">
                      <h2>الملخص اليومي</h2>
                    </header>
                    {visibleDailyRows.length === 0 ? (
                      <p className="reports-panel__empty">
                        لا توجد حركة يومية ضمن هذه الفترة.
                      </p>
                    ) : (
                      <>
                        <div className="reports-panel__scroll">
                          <table className="reports-table reports-table--wide">
                            <thead>
                              <tr>
                                <th>التاريخ</th>
                                <th>الطلبات</th>
                                <th>الوحدات</th>
                                <th>المبيعات</th>
                                <th>المرتجعات</th>
                                <th>الصافي</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedDailyRows.map((row) => (
                                <tr key={row.dateKey}>
                                  <td>{toDateLabel(row.dateKey)}</td>
                                  <td>{row.orders}</td>
                                  <td>{row.units}</td>
                                  <td>{toCurrency(row.grossSales, currency)}</td>
                                  <td>{toCurrency(row.refunds, currency)}</td>
                                  <td>{toCurrency(row.netRevenue, currency)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <TablePagination
                          currentPage={dailyRowsPage}
                          totalPages={dailyRowsTotalPages}
                          onPageChange={setDailyRowsPage}
                        />
                      </>
                    )}
                  </article>
                </section>
              )}

              {activeSection === "risk" && (
                <section className="reports-layout">
                  <article className="reports-panel reports-panel--span-2">
                    <header className="reports-panel__header">
                      <h2>مديونية العملاء</h2>
                    </header>
                    {visibleDebtCustomers.length === 0 ? (
                      <p className="reports-panel__empty">
                        لا توجد مديونية على العملاء حاليًا.
                      </p>
                    ) : (
                      <>
                        <div className="reports-panel__scroll">
                          <table className="reports-table reports-table--wide">
                            <thead>
                              <tr>
                                <th>العميل</th>
                                <th>الهاتف</th>
                                <th>المشتريات</th>
                                <th>إجمالي المنصرف</th>
                                <th>الدين الحالي</th>
                                <th>نسبة الدين</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedDebtCustomers.map((customer) => (
                                <tr key={customer.id}>
                                  <td>{customer.name}</td>
                                  <td>{customer.phone}</td>
                                  <td>{customer.totalPurchases}</td>
                                  <td>{toCurrency(customer.totalSpent, currency)}</td>
                                  <td>{toCurrency(customer.debt, currency)}</td>
                                  <td>{customer.debtRatio.toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <TablePagination
                          currentPage={debtCustomersPage}
                          totalPages={debtCustomersTotalPages}
                          onPageChange={setDebtCustomersPage}
                        />
                      </>
                    )}
                  </article>

                  <article className="reports-panel reports-panel--span-2">
                    <header className="reports-panel__header">
                      <h2>أصناف منخفضة المخزون</h2>
                    </header>
                    {visibleLowStock.length === 0 ? (
                      <p className="reports-panel__empty">
                        لا توجد أصناف منخفضة المخزون.
                      </p>
                    ) : (
                      <>
                        <div className="reports-panel__scroll">
                          <table className="reports-table reports-table--wide">
                            <thead>
                              <tr>
                                <th>الصنف</th>
                                <th>التصنيف</th>
                                <th>المخزون الحالي</th>
                                <th>حد التنبيه</th>
                                <th>قيمة المخزون</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedLowStock.map((item) => (
                                <tr key={item.id}>
                                  <td>{item.name}</td>
                                  <td>{item.categoryName}</td>
                                  <td>{item.stock}</td>
                                  <td>{item.alertThreshold}</td>
                                  <td>{toCurrency(item.stockValue, currency)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <TablePagination
                          currentPage={lowStockPage}
                          totalPages={lowStockTotalPages}
                          onPageChange={setLowStockPage}
                        />
                      </>
                    )}
                  </article>
                </section>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
