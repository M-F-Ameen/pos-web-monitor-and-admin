import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { canAccessPage, getFirstAllowedPage, type AppPage } from "./access";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  page: AppPage;
}

/**
 * Protected route wrapper that handles authentication and role-based access.
 * Redirects to login if not authenticated.
 * Redirects to first allowed page if user doesn't have access to requested page.
 */
export function ProtectedRoute({ children, page }: ProtectedRouteProps) {
  const {
    isAuthenticated,
    role,
    user,
    shiftStartPending,
    confirmShiftStart,
  } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!canAccessPage(role, page, user?.pagePermissions)) {
    const firstAllowed = getFirstAllowedPage(role, user?.pagePermissions);
    return <Navigate to={`/${firstAllowed}`} replace />;
  }

  if (shiftStartPending) {
    return (
      <Modal
        isOpen
        onClose={() => undefined}
        title="بداية الوردية"
        size="sm"
        showCloseButton={false}
        closeOnBackdrop={false}
        closeOnEscape={false}
        footer={
          <Button type="button" variant="primary" onClick={confirmShiftStart}>
            بداية العمل
          </Button>
        }
      >
        <div dir="rtl">
          <p>يرجى تأكيد بداية الوردية قبل بدء العمل.</p>
        </div>
      </Modal>
    );
  }

  return <>{children}</>;
}
