import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./app/AuthContext";
import { DefaultImageProvider } from "./app/DefaultImageContext";
import { ThemeProvider } from "./app/ThemeContext";
import { ProtectedRoute } from "./app/ProtectedRoute";
import { ErrorBoundaryWrapper } from "./components/ui/ErrorBoundary";
import { CustomTitleBar } from "./components/layout/CustomTitleBar";

const POSPage = lazy(async () => ({
  default: (await import("./pages/POSPage")).POSPage,
}));
const InventoryPage = lazy(async () => ({
  default: (await import("./pages/InventoryPage")).InventoryPage,
}));
const CategoriesPage = lazy(async () => ({
  default: (await import("./pages/CategoriesPage")).CategoriesPage,
}));
const SalesPage = lazy(async () => ({
  default: (await import("./pages/SalesPage")).SalesPage,
}));
const ReturnsPage = lazy(async () => ({
  default: (await import("./pages/ReturnsPage")).ReturnsPage,
}));
const UsersPage = lazy(async () => ({
  default: (await import("./pages/UsersPage")).UsersPage,
}));
const ShiftsPage = lazy(async () => ({
  default: (await import("./pages/ShiftsPage")).ShiftsPage,
}));
const ShiftDetailsPage = lazy(async () => ({
  default: (await import("./pages/ShiftDetailsPage")).ShiftDetailsPage,
}));
const CustomersPage = lazy(async () => ({
  default: (await import("./pages/CustomersPage")).CustomersPage,
}));
const SuppliersPage = lazy(async () => ({
  default: (await import("./pages/SuppliersPage")).SuppliersPage,
}));
const TreasuryPage = lazy(async () => ({
  default: (await import("./pages/TreasuryPage")).TreasuryPage,
}));
const BarcodePage = lazy(async () => ({
  default: (await import("./pages/BarcodePage")).BarcodePage,
}));
const ReportsPage = lazy(async () => ({
  default: (await import("./pages/ReportsPage")).ReportsPage,
}));
const SettingsPage = lazy(async () => ({
  default: (await import("./pages/SettingsPage")).SettingsPage,
}));
const LoginPage = lazy(async () => ({
  default: (await import("./pages/LoginPage")).LoginPage,
}));

/**
 * Tobacco POS - Arabic RTL.
 * Main application with React Router v6 for proper navigation.
 * Uses HashRouter for Electron file:// compatibility.
 */
function App() {
  return (
    <ErrorBoundaryWrapper
      onError={(error, errorInfo) => {
        console.error("App-level error:", error, errorInfo);
        // In production, you would send this to an error reporting service
      }}
    >
      <HashRouter>
        <ThemeProvider>
          <DefaultImageProvider>
            <AuthProvider>
              <div className="app-shell">
                <CustomTitleBar />
                <div className="app-shell__routes">
                  <Suspense
                    fallback={
                      <div className="app-shell__loading">Loading...</div>
                    }
                  >
                    <Routes>
                    {/* Login route */}
                    <Route
                      path="/login"
                      element={
                        <ErrorBoundaryWrapper message="حدث خطأ في صفحة تسجيل الدخول">
                          <LoginPage />
                        </ErrorBoundaryWrapper>
                      }
                    />

                    {/* Protected routes with role-based access */}
                    <Route
                      path="/pos"
                      element={
                        <ProtectedRoute page="pos">
                          <ErrorBoundaryWrapper message="حدث خطأ في نظام نقاط البيع">
                            <POSPage />
                          </ErrorBoundaryWrapper>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/inventory"
                      element={
                        <ProtectedRoute page="inventory">
                          <ErrorBoundaryWrapper message="حدث خطأ في إدارة المخزون">
                            <InventoryPage />
                          </ErrorBoundaryWrapper>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/categories"
                      element={
                        <ProtectedRoute page="categories">
                          <ErrorBoundaryWrapper message="حدث خطأ في إدارة التصنيفات">
                            <CategoriesPage />
                          </ErrorBoundaryWrapper>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/sales"
                      element={
                        <ProtectedRoute page="sales">
                          <ErrorBoundaryWrapper message="حدث خطأ في إدارة المبيعات">
                            <SalesPage />
                          </ErrorBoundaryWrapper>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/returns"
                      element={
                        <ProtectedRoute page="returns">
                          <ErrorBoundaryWrapper message="حدث خطأ في إدارة المرتجعات">
                            <ReturnsPage />
                          </ErrorBoundaryWrapper>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/users"
                      element={
                        <ProtectedRoute page="users">
                          <ErrorBoundaryWrapper message="حدث خطأ في إدارة المستخدمين">
                            <UsersPage />
                          </ErrorBoundaryWrapper>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/users/:id"
                      element={<Navigate to="/users" replace />}
                    />
                    <Route
                      path="/users/:id/shifts"
                      element={<Navigate to="/shifts" replace />}
                    />
                    <Route
                      path="/shifts"
                      element={
                        <ProtectedRoute page="shifts">
                          <ErrorBoundaryWrapper message="حدث خطأ في صفحة الورديات">
                            <ShiftsPage />
                          </ErrorBoundaryWrapper>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/shifts/:userId/:shiftId"
                      element={
                        <ProtectedRoute page="shifts">
                          <ErrorBoundaryWrapper message="حدث خطأ في تفاصيل الوردية">
                            <ShiftDetailsPage />
                          </ErrorBoundaryWrapper>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/customers"
                      element={
                        <ProtectedRoute page="customers">
                          <ErrorBoundaryWrapper message="حدث خطأ في إدارة العملاء">
                            <CustomersPage />
                          </ErrorBoundaryWrapper>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/suppliers"
                      element={
                        <ProtectedRoute page="suppliers">
                          <ErrorBoundaryWrapper message="حدث خطأ في إدارة الموردين">
                            <SuppliersPage />
                          </ErrorBoundaryWrapper>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/barcode"
                      element={
                        <ProtectedRoute page="barcode">
                          <ErrorBoundaryWrapper message="حدث خطأ في صفحة الباركود">
                            <BarcodePage />
                          </ErrorBoundaryWrapper>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/treasury"
                      element={
                        <ProtectedRoute page="treasury">
                          <ErrorBoundaryWrapper message="حدث خطأ في إدارة الخزينة">
                            <TreasuryPage />
                          </ErrorBoundaryWrapper>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/reports"
                      element={
                        <ProtectedRoute page="reports">
                          <ErrorBoundaryWrapper message="حدث خطأ في صفحة التقارير">
                            <ReportsPage />
                          </ErrorBoundaryWrapper>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings"
                      element={
                        <ProtectedRoute page="settings">
                          <ErrorBoundaryWrapper message="حدث خطأ في صفحة الإعدادات">
                            <SettingsPage />
                          </ErrorBoundaryWrapper>
                        </ProtectedRoute>
                      }
                    />

                    {/* Default redirect to POS */}
                    <Route path="/" element={<Navigate to="/pos" replace />} />

                    {/* Catch-all redirect */}
                    <Route path="*" element={<Navigate to="/pos" replace />} />
                    </Routes>
                  </Suspense>
                </div>
              </div>
            </AuthProvider>
          </DefaultImageProvider>
        </ThemeProvider>
      </HashRouter>
    </ErrorBoundaryWrapper>
  );
}

export default App;
