import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { settings as settingsService, type ThemeMode } from "../services/db";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
};

const THEME_STORAGE_KEY = "tobacco_pos_theme_mode_v1";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light";
}

function readCachedTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const cachedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeMode(cachedTheme) ? cachedTheme : "dark";
}

function applyTheme(theme: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => readCachedTheme());

  useEffect(() => {
    applyTheme(theme);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    const loadTheme = async () => {
      try {
        const settings = await settingsService.get();
        if (!cancelled && isThemeMode(settings.themeMode)) {
          setThemeState(settings.themeMode);
        }
      } catch (error) {
        console.error("Failed to load theme settings:", error);
      }
    };

    void loadTheme();

    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
    }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
