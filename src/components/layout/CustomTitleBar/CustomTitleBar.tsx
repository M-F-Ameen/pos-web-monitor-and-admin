import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/AuthContext";
import { useTheme } from "../../../app/ThemeContext";
import { settings as settingsService } from "../../../services/db";
import "./CustomTitleBar.css";

function formatTime(now: Date): string {
  return new Intl.DateTimeFormat("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
}

function formatRole(role?: string): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "cashier":
      return "Cashier";
    case "pos":
      return "POS";
    default:
      return "Guest";
  }
}

function FullscreenIcon() {
  return (
    <svg
      className="app-titlebar__control-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 3H3v5" />
      <path d="M16 3h5v5" />
      <path d="M8 21H3v-5" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      className="app-titlebar__control-icon app-titlebar__control-icon--theme"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="app-titlebar__control-icon app-titlebar__control-icon--theme"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3c0 6 4.79 9.79 9.79 9.79Z" />
    </svg>
  );
}

export function CustomTitleBar() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [timeLabel, setTimeLabel] = useState(() => formatTime(new Date()));
  const isElectron = Boolean(window.electronAPI);
  const roleLabel = useMemo(() => formatRole(user?.role), [user?.role]);

  const syncWindowState = useCallback(async () => {
    if (!window.electronAPI) {
      setIsMaximized(false);
      setIsFullscreen(false);
      return;
    }

    try {
      const [maximized, fullscreen] = await Promise.all([
        window.electronAPI.isWindowMaximized(),
        window.electronAPI.isWindowFullscreen(),
      ]);
      setIsMaximized(maximized);
      setIsFullscreen(fullscreen);
    } catch {
      setIsMaximized(false);
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    void syncWindowState();
    const resizeListener = () => {
      void syncWindowState();
    };
    window.addEventListener("resize", resizeListener);
    return () => window.removeEventListener("resize", resizeListener);
  }, [syncWindowState]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLabel(formatTime(new Date()));
    }, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  const handleMinimize = useCallback(() => {
    void window.electronAPI?.minimizeWindow();
  }, []);

  const handleToggleMaximize = useCallback(async () => {
    if (!window.electronAPI) {
      return;
    }

    try {
      const nextMaximizedState = await window.electronAPI.toggleMaximizeWindow();
      setIsMaximized(nextMaximizedState);
      const fullscreen = await window.electronAPI.isWindowFullscreen();
      setIsFullscreen(fullscreen);
    } catch {
      setIsMaximized(false);
      setIsFullscreen(false);
    }
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    if (!window.electronAPI) {
      return;
    }

    try {
      const nextFullscreenState =
        await window.electronAPI.toggleFullscreenWindow();
      setIsFullscreen(nextFullscreenState);
      const maximized = await window.electronAPI.isWindowMaximized();
      setIsMaximized(maximized);
    } catch {
      setIsFullscreen(false);
    }
  }, []);

  const handleClose = useCallback(() => {
    void window.electronAPI?.closeWindow();
  }, []);

  const handleToggleTheme = useCallback(async () => {
    const previousTheme = theme;
    const nextTheme = theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    setIsSavingTheme(true);

    try {
      await settingsService.update({ themeMode: nextTheme });
    } catch {
      setTheme(previousTheme);
    } finally {
      setIsSavingTheme(false);
    }
  }, [setTheme, theme]);

  return (
    <header className="app-titlebar" role="banner">
      <div className="app-titlebar__brand" aria-label="App name">
        <span className="app-titlebar__dot" aria-hidden />
        <span className="app-titlebar__name">Freedom POS</span>
      </div>

      <div className="app-titlebar__center">
        {user?.fullName && (
          <span className="app-titlebar__user" title={user.fullName}>
            {user.fullName}
          </span>
        )}
        {user?.role && (
          <span className="app-titlebar__role" title={`Role: ${roleLabel}`}>
            {roleLabel}
          </span>
        )}
        <span className="app-titlebar__time">{timeLabel}</span>
      </div>

      <div className="app-titlebar__controls" aria-label="Window controls">
        <button
          type="button"
          className="app-titlebar__control app-titlebar__control--theme"
          aria-label={
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
          title={theme === "dark" ? "Light mode" : "Dark mode"}
          onClick={() => {
            void handleToggleTheme();
          }}
          disabled={isSavingTheme}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
        <button
          type="button"
          className="app-titlebar__control"
          aria-label="Minimize window"
          title="Minimize"
          onClick={handleMinimize}
          disabled={!isElectron}
        >
          -
        </button>
        <button
          type="button"
          className="app-titlebar__control"
          aria-label={isMaximized ? "Restore window" : "Maximize window"}
          title={isMaximized ? "Restore" : "Maximize"}
          onClick={handleToggleMaximize}
          disabled={!isElectron}
        >
          {isMaximized ? "[]" : "[ ]"}
        </button>
        <button
          type="button"
          className={
            isFullscreen
              ? "app-titlebar__control app-titlebar__control--fullscreen app-titlebar__control--active"
              : "app-titlebar__control app-titlebar__control--fullscreen"
          }
          aria-label={
            isFullscreen ? "Exit fullscreen mode" : "Enter fullscreen mode"
          }
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={handleToggleFullscreen}
          disabled={!isElectron}
        >
          <FullscreenIcon />
        </button>
        <button
          type="button"
          className="app-titlebar__control app-titlebar__control--close"
          aria-label="Close window"
          title="Close"
          onClick={handleClose}
          disabled={!isElectron}
        >
          X
        </button>
      </div>
    </header>
  );
}
