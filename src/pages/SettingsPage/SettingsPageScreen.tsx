import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildSidebarNavItems } from "../../app/appSidebarNav";
import { useAuth } from "../../app/AuthContext";
import { useDefaultImageContext } from "../../app/DefaultImageContext";
import { useTheme } from "../../app/ThemeContext";
import { DEFAULT_IMAGE } from "../../assets/defaultImage";
import { NavSidebar } from "../../components/layout/NavSidebar";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { IconGrid } from "../../components/ui/Icons";
import {
  printers as printersService,
  settings as settingsService,
} from "../../services/db";
import type {
  AutoBackupStatus,
  DataResetSummary,
  DataScope,
  InstalledPrinter,
  POSSettings,
  ThemeMode,
} from "../../services/db";
import { SettingsBackupSection } from "./SettingsBackupSection";
import { SettingsDialogs } from "./SettingsDialogs";
import { SettingsGeneralSection } from "./SettingsGeneralSection";
import { SettingsPrintSection } from "./SettingsPrintSection";
import {
  DATA_SCOPE_CONFIG,
  DEFAULT_SETTINGS_FORM,
  RESET_MANDATORY_BACKUP_SCOPE,
  RESET_METRIC_LABELS,
  SETTINGS_TABS,
  type SettingsTab,
} from "./settingsPage.config";
import "./SettingsPage.css";

export function SettingsPage() {
  const navigate = useNavigate();
  const { role, logout } = useAuth();
  const { setTheme } = useTheme();
  const { defaultProductImage, setDefaultProductImage } =
    useDefaultImageContext();
  const canManage = role === "admin";

  const [settings, setSettings] = useState<POSSettings>(DEFAULT_SETTINGS_FORM);
  const [loading, setLoading] = useState(false);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [savingThemeMode, setSavingThemeMode] = useState<ThemeMode | null>(
    null,
  );
  const [printingTestReceipt, setPrintingTestReceipt] = useState(false);
  const [installedPrinters, setInstalledPrinters] = useState<
    InstalledPrinter[]
  >([]);
  const [recommendedPrinterName, setRecommendedPrinterName] = useState<
    string | null
  >(null);
  const [defaultPrinterName, setDefaultPrinterName] = useState<string | null>(
    null,
  );
  const [xp80cAvailable, setXp80cAvailable] = useState(false);
  const [pendingResetScope, setPendingResetScope] = useState<DataScope | null>(
    null,
  );
  const [pendingRestoreScope, setPendingRestoreScope] =
    useState<DataScope | null>(null);
  const [activeResetScope, setActiveResetScope] = useState<DataScope | null>(
    null,
  );
  const [activeBackupScope, setActiveBackupScope] = useState<DataScope | null>(
    null,
  );
  const [activeRestoreScope, setActiveRestoreScope] =
    useState<DataScope | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [autoBackupStatus, setAutoBackupStatus] =
    useState<AutoBackupStatus | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success",
  );
  const messageTimeoutRef = useRef<number | null>(null);

  const creatingBackup = activeBackupScope !== null;
  const restoringBackup = activeRestoreScope !== null;
  const resettingData = activeResetScope !== null;
  const hasDataTaskInProgress =
    creatingBackup || restoringBackup || resettingData;

  const loadSettings = useCallback(async () => {
    try {
      const data = await settingsService.get();
      setSettings(data);
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }, []);

  const loadPrinters = useCallback(async () => {
    setLoadingPrinters(true);
    try {
      const result = await printersService.list();
      setInstalledPrinters(result.printers);
      setRecommendedPrinterName(result.recommendedPrinterName);
      setDefaultPrinterName(result.defaultPrinterName);
      setXp80cAvailable(result.xp80cAvailable);
    } catch (error) {
      console.error("Failed to load printers:", error);
      setInstalledPrinters([]);
      setRecommendedPrinterName(null);
      setDefaultPrinterName(null);
      setXp80cAvailable(false);
    } finally {
      setLoadingPrinters(false);
    }
  }, []);

  const loadAutoBackupStatus = useCallback(async () => {
    try {
      const status = await settingsService.getAutoBackupStatus();
      setAutoBackupStatus(status);
    } catch {
      // Non-critical.
    }
  }, []);

  useEffect(() => {
    void loadSettings();
    void loadPrinters();
    void loadAutoBackupStatus();
  }, [loadAutoBackupStatus, loadPrinters, loadSettings]);

  useEffect(() => {
    setTheme(settings.themeMode);
  }, [settings.themeMode, setTheme]);

  const clearMessageTimeout = useCallback(() => {
    if (messageTimeoutRef.current !== null) {
      window.clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }
  }, []);

  const showMessage = useCallback(
    (text: string, type: "success" | "error", clearAfterMs?: number) => {
      clearMessageTimeout();
      setMessage(text);
      setMessageType(type);

      if (clearAfterMs && clearAfterMs > 0) {
        messageTimeoutRef.current = window.setTimeout(() => {
          setMessage("");
          messageTimeoutRef.current = null;
        }, clearAfterMs);
      }
    },
    [clearMessageTimeout],
  );

  const clearMessage = useCallback(() => {
    clearMessageTimeout();
    setMessage("");
  }, [clearMessageTimeout]);

  useEffect(
    () => () => {
      clearMessageTimeout();
    },
    [clearMessageTimeout],
  );

  const formatFileSize = (sizeBytes?: number): string => {
    if (sizeBytes == null || Number.isNaN(sizeBytes)) {
      return "";
    }

    const kb = 1024;
    const mb = kb * 1024;

    if (sizeBytes >= mb) {
      return `${(sizeBytes / mb).toFixed(2)} MB`;
    }

    return `${(sizeBytes / kb).toFixed(2)} KB`;
  };

  const handleInputChange =
    (field: keyof POSSettings) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!canManage) return;

      const value = event.target.value;
      setSettings((previous) => ({
        ...previous,
        [field]: field === "taxRate" ? parseFloat(value) || 0 : value,
      }));
    };

  const handleCheckboxChange =
    (field: keyof POSSettings) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!canManage) return;

      setSettings((previous) => ({
        ...previous,
        [field]: event.target.checked,
      }));
    };

  const handleSelectChange =
    (field: keyof POSSettings) =>
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      if (!canManage) return;

      setSettings((previous) => ({
        ...previous,
        [field]: event.target.value,
      }));
    };

  const handleThemeModeChange = async (themeMode: ThemeMode) => {
    if (!canManage || settings.themeMode === themeMode) {
      return;
    }

    const previousThemeMode = settings.themeMode;
    setSettings((previous) => ({
      ...previous,
      themeMode,
    }));
    setTheme(themeMode);
    setSavingThemeMode(themeMode);
    clearMessage();

    try {
      await settingsService.update({ themeMode });
      showMessage("تم تحديث مظهر التطبيق", "success", 2500);
    } catch (error) {
      console.error("Failed to update theme mode:", error);
      setSettings((previous) => ({
        ...previous,
        themeMode: previousThemeMode,
      }));
      setTheme(previousThemeMode);
      showMessage("فشل في تحديث مظهر التطبيق", "error");
    } finally {
      setSavingThemeMode(null);
    }
  };

  const handleSave = async () => {
    if (!canManage) return;

    setLoading(true);
    clearMessage();

    try {
      await settingsService.update(
        settings as unknown as Record<string, unknown>,
      );
      showMessage("تم حفظ الإعدادات بنجاح", "success", 3000);
    } catch (error) {
      console.error("Failed to update settings:", error);
      showMessage("فشل في حفظ الإعدادات", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (!canManage) return;

    void loadSettings();
    showMessage("تم إعادة ضبط الإعدادات", "success", 3000);
  };

  const handleDefaultImageFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!canManage) return;

    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;

      try {
        await settingsService.update({ defaultProductImage: base64 });
        setDefaultProductImage(base64);
        showMessage("تم تحديث الصورة الافتراضية", "success", 3000);
      } catch {
        showMessage("فشل في حفظ الصورة الافتراضية", "error");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetDefaultImage = async () => {
    if (!canManage) return;

    try {
      await settingsService.update({ defaultProductImage: "" });
      setDefaultProductImage(DEFAULT_IMAGE);
      showMessage("تم إعادة تعيين الصورة الافتراضية", "success", 3000);
    } catch {
      showMessage("فشل في إعادة تعيين الصورة", "error");
    }
  };

  const formatResetSummaryMessage = (summary: DataResetSummary): string => {
    const scopeTitle = DATA_SCOPE_CONFIG[summary.scope].cardTitle;
    const details = Object.entries(summary.affectedRows)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => `${RESET_METRIC_LABELS[key] ?? key}: ${count}`)
      .join(" | ");

    const reseedMessage = summary.defaultsReseeded
      ? " تمت إعادة تهيئة بيانات البداية الافتراضية."
      : "";

    if (!details) {
      return `تمت إعادة تعيين ${scopeTitle} بنجاح.${reseedMessage}`;
    }

    return `تمت إعادة تعيين ${scopeTitle} بنجاح. ${details}.${reseedMessage}`;
  };

  const handleOpenResetModal = (scope: DataScope) => {
    if (!canManage) return;
    setPendingResetScope(scope);
  };

  const handleCloseResetModal = () => {
    if (resettingData) return;
    setPendingResetScope(null);
  };

  const handleResetData = async () => {
    if (!canManage || !pendingResetScope) return;

    const scope = pendingResetScope;
    setActiveResetScope(scope);
    clearMessage();

    try {
      const autoBackupResult = await settingsService.createAutoBackup(
        RESET_MANDATORY_BACKUP_SCOPE,
      );

      if (autoBackupResult.canceled || !autoBackupResult.backupPath) {
        throw new Error(
          "تعذّر إنشاء النسخة الاحتياطية التلقائية المطلوبة قبل إعادة التعيين.",
        );
      }

      const summary = await settingsService.resetData(scope);
      const backupSizeLabel = formatFileSize(autoBackupResult.fileSizeBytes);
      const backupSizeSuffix = backupSizeLabel ? ` (${backupSizeLabel})` : "";
      const backupMessage = `تم إنشاء نسخة احتياطية تلقائية إلزامية قبل إعادة التعيين: ${autoBackupResult.backupPath}${backupSizeSuffix}.`;

      showMessage(
        `${backupMessage} ${formatResetSummaryMessage(summary)}`,
        "success",
        9000,
      );
      setPendingResetScope(null);

      if (scope === "system") {
        window.setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else if (scope === "operations") {
        window.setTimeout(() => {
          logout();
          navigate("/login");
        }, 1500);
      }
    } catch (error) {
      console.error("Failed to reset data scope:", error);
      const details = error instanceof Error ? ` (${error.message})` : "";
      showMessage(`فشل في إعادة التعيين.${details}`, "error");
    } finally {
      setActiveResetScope(null);
    }
  };

  const handlePrintTestReceipt = async () => {
    setPrintingTestReceipt(true);
    clearMessage();

    try {
      const printResult = await printersService.printTestReceipt({
        preferredPrinterName: settings.receiptPrinterName || undefined,
        fallbackToDefault: true,
      });

      if (!printResult.success) {
        const reason = printResult.error ? ` (${printResult.error})` : "";
        showMessage(`فشل طباعة إيصال الاختبار.${reason}`, "error");
        return;
      }

      if (printResult.warning) {
        showMessage(
          `تمت الطباعة بنجاح. ${printResult.warning}`,
          "success",
          5000,
        );
        return;
      }

      const printerLabel = printResult.printerName
        ? ` على ${printResult.printerName}`
        : "";
      showMessage(
        `تمت طباعة إيصال الاختبار بنجاح${printerLabel}.`,
        "success",
        5000,
      );
    } catch (error) {
      console.error("Failed to print test receipt:", error);
      const details = error instanceof Error ? ` (${error.message})` : "";
      showMessage(`فشل طباعة إيصال الاختبار.${details}`, "error");
    } finally {
      setPrintingTestReceipt(false);
    }
  };

  const handleCreateBackup = async (scope: DataScope) => {
    if (!canManage) return;

    setActiveBackupScope(scope);
    clearMessage();

    try {
      const backupResult = await settingsService.createBackup(scope);
      if (backupResult.canceled) {
        return;
      }

      const fileSizeLabel = formatFileSize(backupResult.fileSizeBytes);
      const sizeSuffix = fileSizeLabel ? ` (${fileSizeLabel})` : "";
      const backupPathLabel = backupResult.backupPath ?? "مسار غير متاح";

      showMessage(
        `تم إنشاء نسخة احتياطية (${DATA_SCOPE_CONFIG[scope].cardTitle}) بنجاح: ${backupPathLabel}${sizeSuffix}`,
        "success",
        7000,
      );
      void loadAutoBackupStatus();
    } catch (error) {
      console.error("Failed to create backup:", error);
      const details = error instanceof Error ? ` (${error.message})` : "";
      showMessage(`فشل إنشاء النسخة الاحتياطية.${details}`, "error");
    } finally {
      setActiveBackupScope(null);
    }
  };

  const handleOpenRestoreModal = (scope: DataScope) => {
    if (!canManage) return;
    setPendingRestoreScope(scope);
  };

  const handleCloseRestoreModal = () => {
    if (restoringBackup) return;
    setPendingRestoreScope(null);
  };

  const handleRestoreBackup = async () => {
    if (!canManage || !pendingRestoreScope) return;

    const scope = pendingRestoreScope;
    setActiveRestoreScope(scope);
    clearMessage();

    try {
      const restoreResult = await settingsService.restoreBackup(scope);
      if (restoreResult.canceled) {
        setPendingRestoreScope(null);
        return;
      }

      setPendingRestoreScope(null);
      const rollbackPathLabel = restoreResult.rollbackBackupPath
        ? ` تم حفظ نسخة أمان قبل الاستعادة في: ${restoreResult.rollbackBackupPath}`
        : "";

      showMessage(
        `تمت استعادة النسخة الاحتياطية (${DATA_SCOPE_CONFIG[scope].cardTitle}) بنجاح.${rollbackPathLabel} سيتم تحديث التطبيق الآن.`,
        "success",
        8000,
      );

      if (restoreResult.requiresReload !== false) {
        window.setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch (error) {
      console.error("Failed to restore backup:", error);
      const details = error instanceof Error ? ` (${error.message})` : "";
      showMessage(`فشلت استعادة النسخة الاحتياطية.${details}`, "error");
    } finally {
      setActiveRestoreScope(null);
    }
  };

  if (!role) {
    return null;
  }

  return (
    <div className="settings-page">
      <NavSidebar
        items={buildSidebarNavItems("settings", role)}
        collapsed={false}
        topAction={
          <IconButton variant="accent" aria-label="القائمة الرئيسية">
            <IconGrid />
          </IconButton>
        }
        onItemClick={(id) => {
          if (id === "settings") return;
          navigate(`/${id}`);
        }}
        onLogout={() => {
          logout();
          navigate("/login");
        }}
      />

      <main className="settings-page__main">
        <header className="settings-page__header">
          <div className="settings-page__header-content">
            <h1 className="settings-page__title">إعدادات النظام</h1>
          </div>
        </header>

        <section className="settings-page__content">
          {message && (
            <div
              className={`settings-page__message ${
                messageType === "success"
                  ? "settings-page__message--success"
                  : "settings-page__message--error"
              }`}
            >
              {message}
            </div>
          )}

          <div
            className="settings-page__tabs"
            role="tablist"
            aria-label="أقسام الإعدادات"
          >
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`settings-tab-${tab.id}`}
                className={`settings-page__tab ${
                  activeTab === tab.id ? "settings-page__tab--active" : ""
                }`}
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "general" && (
            <SettingsGeneralSection
              canManage={canManage}
              defaultProductImage={defaultProductImage}
              handleCheckboxChange={handleCheckboxChange}
              handleDefaultImageFileChange={handleDefaultImageFileChange}
              handleInputChange={handleInputChange}
              handleResetDefaultImage={handleResetDefaultImage}
              handleSelectChange={handleSelectChange}
              handleThemeModeChange={handleThemeModeChange}
              savingThemeMode={savingThemeMode}
              settings={settings}
            />
          )}

          {activeTab === "backup" && (
            <SettingsBackupSection
              activeBackupScope={activeBackupScope}
              autoBackupStatus={autoBackupStatus}
              canManage={canManage}
              hasDataTaskInProgress={hasDataTaskInProgress}
              loading={loading}
              onCreateBackup={handleCreateBackup}
              onOpenResetModal={handleOpenResetModal}
              onOpenRestoreModal={handleOpenRestoreModal}
            />
          )}

          {activeTab === "print" && (
            <SettingsPrintSection
              defaultPrinterName={defaultPrinterName}
              handlePrintTestReceipt={handlePrintTestReceipt}
              handleSelectChange={handleSelectChange}
              installedPrinters={installedPrinters}
              loadingPrinters={loadingPrinters}
              onReloadPrinters={loadPrinters}
              printingTestReceipt={printingTestReceipt}
              recommendedPrinterName={recommendedPrinterName}
              settings={settings}
              xp80cAvailable={xp80cAvailable}
            />
          )}

          <div className="settings-page__actions">
            <p className="settings-page__actions-note">
              تأكد من حفظ الإعدادات بعد أي تعديل
            </p>
            <div className="settings-page__actions-buttons">
              <Button
                variant="primary"
                onClick={() => void handleSave()}
                loading={loading}
                disabled={loading || hasDataTaskInProgress || !canManage}
              >
                حفظ الإعدادات
              </Button>
              <Button
                variant="secondary"
                onClick={handleReset}
                disabled={loading || hasDataTaskInProgress || !canManage}
              >
                إعادة ضبط
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SettingsDialogs
        canManage={canManage}
        onCloseResetModal={handleCloseResetModal}
        onCloseRestoreModal={handleCloseRestoreModal}
        onConfirmReset={handleResetData}
        onConfirmRestore={handleRestoreBackup}
        pendingResetScope={pendingResetScope}
        pendingRestoreScope={pendingRestoreScope}
        resettingData={resettingData}
        restoringBackup={restoringBackup}
      />
    </div>
  );
}
