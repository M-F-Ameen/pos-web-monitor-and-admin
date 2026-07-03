import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { UserRole } from "./access";
import { auth as authService } from "../services/db";
import type { User } from "../services/db";

const SESSION_STORAGE_KEY = "tobacco_pos_session_v1";

interface StoredSession {
  user: User;
  shiftId?: string;
  shiftStartPending: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  role: UserRole;
  user: User | null;
  shiftStartPending: boolean;
  confirmShiftStart: () => void;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function loadSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.user?.id || !parsed?.user?.role) {
      return null;
    }

    return {
      user: parsed.user,
      shiftId:
        typeof parsed.shiftId === "string" && parsed.shiftId.trim().length > 0
          ? parsed.shiftId
          : undefined,
      shiftStartPending: parsed.shiftStartPending === true,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() =>
    loadSession(),
  );

  const user = session?.user ?? null;
  const isAuthenticated = !!user;
  const role: UserRole = user?.role ?? "admin";
  const shiftStartPending = session?.shiftStartPending ?? false;

  useEffect(() => {
    if (session) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [session]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const result = await authService.login(email, password);
      if (result.success && result.user) {
        setSession({
          user: result.user,
          shiftId: result.shiftId,
          shiftStartPending: true,
        });
        return { success: true };
      }
      return {
        success: false,
        error: result.error ?? "بيانات الدخول غير صحيحة.",
      };
    } catch {
      return { success: false, error: "حدث خطأ أثناء تسجيل الدخول." };
    }
  }, []);

  const confirmShiftStart = useCallback(() => {
    setSession((current) => {
      if (!current || !current.shiftStartPending) {
        return current;
      }
      return { ...current, shiftStartPending: false };
    });
  }, []);

  const logout = useCallback(() => {
    const current = session;
    setSession(null);

    if (!current?.user?.id) {
      return;
    }

    void authService.logout(current.user.id, current.shiftId).catch((error) => {
      console.error("Failed to close shift on logout:", error);
    });
  }, [session]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        role,
        user,
        shiftStartPending,
        confirmShiftStart,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
