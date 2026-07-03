import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type PrinterInfo,
} from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { initDatabase, closeDatabase, seedDatabase, getDb } from "./database";
import { startSyncServer, stopSyncServer } from "./sync-server";
import * as usersService from "./services/users.service";
import * as categoriesService from "./services/categories.service";
import * as productsService from "./services/products.service";
import * as customersService from "./services/customers.service";
import * as suppliersService from "./services/suppliers.service";
import * as salesService from "./services/sales.service";
import * as returnsService from "./services/returns.service";
import * as treasuryService from "./services/treasury.service";
import * as settingsService from "./services/settings.service";
import * as backupService from "./services/backup.service";
import * as reportsService from "./services/reports.service";
import * as dataRetentionService from "./services/data-retention.service";
import type {
  AutoBackupStatus,
  DataBackupResult,
  DataRestoreResult,
  DataScope,
  InstalledPrinter,
  PrinterListResult,
  ReceiptPrintOptions,
  ReceiptPrintResult,
  ReceiptPrinterSource,
} from "./shared/types";
import type { ZodType } from "zod";
import * as V from "./ipc-schemas";

// ============================================
// Constants
// ============================================

const isDev = !app.isPackaged;
const RECEIPT_TARGET_PRINTER_NAME = "XP-80C";
/** Candidate names for thermal receipt printer (XP-K200L with XP-80C driver, etc.) */
const RECEIPT_TARGET_PRINTER_CANDIDATES = [
  "XP-80C",
  "XP-K200L",
  "printerPOS-80 XP-80C",
  "printerPOS-80",
  "XP-80",
];
const PRINT_LOAD_TIMEOUT_MS = 8000;
const DATA_RETENTION_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const DATA_RETENTION_INITIAL_DELAY_MS = 2 * 60 * 1000;
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const AUTO_BACKUP_INITIAL_DELAY_MS = 5 * 60 * 1000;
const AUTO_BACKUP_SCOPE: DataScope = "system";
const AUTO_BACKUP_FILE_PREFIX = "tobacco_pos_system_backup_";
const AUTO_BACKUP_MAX_FILES = 42;

/** Thermal receipt paper: 80(72.1) x 297 mm in microns */
const THERMAL_RECEIPT_PAGE_SIZE_MICRONS: PrintPageSizeMicrons = {
  width: 72_100,
  height: 297_000,
};

type PrintPageSizeMicrons = {
  width: number;
  height: number;
};

type PrintHtmlOptions = {
  printerName?: string;
  printerNameCandidates?: string[];
  pageSizeMicrons?: PrintPageSizeMicrons;
  silent?: boolean;
};

type PrintRunResult = {
  success: boolean;
  failureReason?: string;
};

type PrintRunOptions = {
  silent: boolean;
  deviceName?: string;
  pageSizeMicrons?: PrintPageSizeMicrons;
};

type ResolvedReceiptPrinter = {
  deviceName: string | null;
  source: ReceiptPrinterSource;
  usedFallback: boolean;
  warning?: string;
  error?: string;
};

function normalizePrinterName(value: string): string {
  return value.toLowerCase().replace(/[\s\-_]+/g, "");
}

function sanitizePrinterName(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function mapInstalledPrinters(printers: PrinterInfo[]): InstalledPrinter[] {
  return printers.map((printer) => ({
    name: printer.name,
    displayName: printer.displayName,
    description: printer.description,
    status: printer.status,
    isDefault: printer.isDefault,
  }));
}

function findPrinterByName(
  installedPrinters: InstalledPrinter[],
  name: string,
): InstalledPrinter | undefined {
  const exact = installedPrinters.find((printer) => printer.name === name);
  if (exact) {
    return exact;
  }

  const normalizedRequestedName = normalizePrinterName(name);
  return installedPrinters.find(
    (printer) => normalizePrinterName(printer.name) === normalizedRequestedName,
  );
}

function findDefaultPrinter(
  installedPrinters: InstalledPrinter[],
): InstalledPrinter | undefined {
  return installedPrinters.find((printer) => printer.isDefault);
}

/**
 * Find thermal receipt printer by trying multiple candidate names (exact then partial match).
 * Matches XP-80C, XP-K200L, printerPOS-80 XP-80C, etc.
 */
function findThermalReceiptPrinter(
  installedPrinters: InstalledPrinter[],
): InstalledPrinter | undefined {
  for (const candidate of RECEIPT_TARGET_PRINTER_CANDIDATES) {
    const found = findPrinterByName(installedPrinters, candidate);
    if (found) return found;
  }
  const normalizedCandidates = RECEIPT_TARGET_PRINTER_CANDIDATES.map((c) =>
    normalizePrinterName(c),
  );
  for (const candidate of normalizedCandidates) {
    const partial = installedPrinters.find((printer) => {
      const n = normalizePrinterName(printer.name);
      return n.includes(candidate) || candidate.includes(n);
    });
    if (partial) return partial;
  }
  return undefined;
}

function waitForDidFinishLoad(printWindow: BrowserWindow): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while loading print document."));
    }, PRINT_LOAD_TIMEOUT_MS);

    const handleDidFinishLoad = () => {
      cleanup();
      resolve();
    };

    const handleDidFailLoad = (
      _event: unknown,
      code: number,
      description: string,
    ) => {
      cleanup();
      reject(
        new Error(
          `Failed to load print document (code ${code}): ${description}`,
        ),
      );
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      printWindow.webContents.removeListener(
        "did-finish-load",
        handleDidFinishLoad,
      );
      printWindow.webContents.removeListener(
        "did-fail-load",
        handleDidFailLoad,
      );
    };

    printWindow.webContents.on("did-finish-load", handleDidFinishLoad);
    printWindow.webContents.on("did-fail-load", handleDidFailLoad);
  });
}

async function loadHtmlIntoPrintWindow(
  printWindow: BrowserWindow,
  html: string,
): Promise<void> {
  const didFinishLoadPromise = waitForDidFinishLoad(printWindow);
  await printWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
  );
  await didFinishLoadPromise;
}

async function loadBlankPage(printWindow: BrowserWindow): Promise<void> {
  const didFinishLoadPromise = waitForDidFinishLoad(printWindow);
  await printWindow.loadURL("about:blank");
  await didFinishLoadPromise;
}

function runPrintJob(
  printWindow: BrowserWindow,
  options: PrintRunOptions,
): Promise<PrintRunResult> {
  return new Promise((resolve) => {
    const printOptions = {
      silent: options.silent,
      printBackground: true,
      margins: { marginType: "none" as const },
      ...(options.deviceName ? { deviceName: options.deviceName } : {}),
      ...(options.pageSizeMicrons ? { pageSize: options.pageSizeMicrons } : {}),
    };

    printWindow.webContents.print(printOptions, (success, failureReason) => {
      resolve({
        success,
        failureReason: failureReason || undefined,
      });
    });
  });
}

async function withHiddenPrintWindow<T>(
  run: (printWindow: BrowserWindow) => Promise<T>,
): Promise<T> {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
    },
  });

  try {
    return await run(printWindow);
  } finally {
    if (!printWindow.isDestroyed()) {
      printWindow.close();
    }
  }
}

function resolvePrinterDeviceName(
  installedPrinters: InstalledPrinter[],
  options?: PrintHtmlOptions,
): string | undefined {
  const rawCandidates = [
    options?.printerName,
    ...(options?.printerNameCandidates ?? []),
  ].filter((name): name is string => Boolean(name?.trim()));

  if (rawCandidates.length === 0) {
    return undefined;
  }

  const normalizedCandidates = rawCandidates.map((candidate) =>
    normalizePrinterName(candidate),
  );

  for (const candidate of normalizedCandidates) {
    const exact = installedPrinters.find(
      (printer) => normalizePrinterName(printer.name) === candidate,
    );
    if (exact) {
      return exact.name;
    }
  }

  for (const candidate of normalizedCandidates) {
    const partial = installedPrinters.find((printer) => {
      const normalizedName = normalizePrinterName(printer.name);
      return (
        normalizedName.includes(candidate) || candidate.includes(normalizedName)
      );
    });
    if (partial) {
      return partial.name;
    }
  }

  return undefined;
}

function resolveReceiptPrinter(
  installedPrinters: InstalledPrinter[],
  preferredPrinterName: string | null,
  fallbackToDefault: boolean,
): ResolvedReceiptPrinter {
  if (installedPrinters.length === 0) {
    return {
      deviceName: null,
      source: "none",
      usedFallback: false,
      error: "No printers are installed on this Windows machine.",
    };
  }

  const defaultPrinter = findDefaultPrinter(installedPrinters);
  const thermalPrinter = findThermalReceiptPrinter(installedPrinters);

  if (preferredPrinterName) {
    const preferredPrinter = findPrinterByName(
      installedPrinters,
      preferredPrinterName,
    );

    if (preferredPrinter) {
      return {
        deviceName: preferredPrinter.name,
        source: "user-override",
        usedFallback: false,
      };
    }

    if (fallbackToDefault && thermalPrinter) {
      return {
        deviceName: thermalPrinter.name,
        source: "xp-80c",
        usedFallback: true,
        warning: `Selected printer "${preferredPrinterName}" was not found. Printed using "${thermalPrinter.name}".`,
      };
    }

    if (fallbackToDefault && defaultPrinter) {
      return {
        deviceName: defaultPrinter.name,
        source: "default",
        usedFallback: true,
        warning: `Selected printer "${preferredPrinterName}" was not found. Printed using default printer "${defaultPrinter.name}".`,
      };
    }

    return {
      deviceName: null,
      source: "none",
      usedFallback: false,
      error: `Selected printer "${preferredPrinterName}" was not found.`,
    };
  }

  if (thermalPrinter) {
    return {
      deviceName: thermalPrinter.name,
      source: "xp-80c",
      usedFallback: false,
    };
  }

  if (fallbackToDefault && defaultPrinter) {
    return {
      deviceName: defaultPrinter.name,
      source: "default",
      usedFallback: true,
      warning: `Thermal receipt printer was not found. Printed using default printer "${defaultPrinter.name}".`,
    };
  }

  return {
    deviceName: null,
    source: "none",
    usedFallback: false,
    error:
      "No receipt printer found. Set your thermal printer as default or select it in Settings.",
  };
}

function buildPrinterListResult(
  installedPrinters: InstalledPrinter[],
  userOverride: string | null,
): PrinterListResult {
  const defaultPrinter = findDefaultPrinter(installedPrinters);
  const thermalPrinter = findThermalReceiptPrinter(installedPrinters);
  const matchedOverride = userOverride
    ? findPrinterByName(installedPrinters, userOverride)
    : null;
  const recommendedPrinterName =
    thermalPrinter?.name ?? defaultPrinter?.name ?? null;
  const selectedPrinterName = matchedOverride?.name ?? recommendedPrinterName;

  return {
    printers: installedPrinters,
    userOverride,
    recommendedPrinterName,
    selectedPrinterName,
    defaultPrinterName: defaultPrinter?.name ?? null,
    xp80cAvailable: Boolean(thermalPrinter),
  };
}

function buildTestReceiptHtml(): string {
  const now = new Date();
  const pad2 = (value: number) => String(value).padStart(2, "0");
  const printedAt = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate(),
  )} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Printer Test</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      width: 80mm;
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: "Courier New", monospace;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt {
      width: 80mm;
      padding: 3mm;
      font-size: 11px;
      line-height: 1.35;
    }
    .center { text-align: center; }
    .divider {
      border-top: 1px dashed #000;
      margin: 2.4mm 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 2mm;
    }
    .muted { font-size: 10px; }
  </style>
</head>
<body>
  <section class="receipt">
    <div class="center"><strong>RECEIPT PRINTER TEST</strong></div>
    <div class="center muted">Target: ${RECEIPT_TARGET_PRINTER_NAME}</div>
    <div class="divider"></div>
    <div class="row"><span>Status</span><strong>OK</strong></div>
    <div class="row"><span>Printed At</span><span>${printedAt}</span></div>
    <div class="divider"></div>
    <div class="center muted">If this is clear and centered, setup is ready.</div>
  </section>
</body>
</html>`;
}

async function listInstalledPrinters(): Promise<InstalledPrinter[]> {
  return withHiddenPrintWindow(async (printWindow) => {
    await loadBlankPage(printWindow);
    const printers = await printWindow.webContents.getPrintersAsync();
    return mapInstalledPrinters(printers);
  });
}

async function printReceiptSilently(
  html: string,
  options?: ReceiptPrintOptions,
): Promise<ReceiptPrintResult> {
  const savedOverride = sanitizePrinterName(
    settingsService.getSettings().receiptPrinterName,
  );
  const preferredPrinterName =
    sanitizePrinterName(options?.preferredPrinterName) ?? savedOverride;
  const fallbackToDefault = options?.fallbackToDefault !== false;

  try {
    return await withHiddenPrintWindow(async (printWindow) => {
      await loadHtmlIntoPrintWindow(printWindow, html);
      const printers = mapInstalledPrinters(
        await printWindow.webContents.getPrintersAsync(),
      );
      const resolvedPrinter = resolveReceiptPrinter(
        printers,
        preferredPrinterName,
        fallbackToDefault,
      );

      if (!resolvedPrinter.deviceName) {
        const errorMessage =
          resolvedPrinter.error ?? "No available printer could be resolved.";
        console.error(
          "[print] Receipt printer resolution failed:",
          errorMessage,
        );
        return {
          success: false,
          printerName: null,
          source: resolvedPrinter.source,
          usedFallback: resolvedPrinter.usedFallback,
          warning: resolvedPrinter.warning,
          error: errorMessage,
        };
      }

      const printResult = await runPrintJob(printWindow, {
        silent: true,
        deviceName: resolvedPrinter.deviceName,
        pageSizeMicrons: THERMAL_RECEIPT_PAGE_SIZE_MICRONS,
      });

      if (!printResult.success) {
        const failureMessage =
          printResult.failureReason ?? "Unknown print failure.";
        console.error("[print] Receipt print failed:", failureMessage);
        return {
          success: false,
          printerName: resolvedPrinter.deviceName,
          source: resolvedPrinter.source,
          usedFallback: resolvedPrinter.usedFallback,
          warning: resolvedPrinter.warning,
          error: failureMessage,
        };
      }

      if (resolvedPrinter.warning) {
        console.warn("[print] Receipt print warning:", resolvedPrinter.warning);
      }

      return {
        success: true,
        printerName: resolvedPrinter.deviceName,
        source: resolvedPrinter.source,
        usedFallback: resolvedPrinter.usedFallback,
        warning: resolvedPrinter.warning,
      };
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown print error.";
    console.error("[print] Failed to run receipt print job:", error);
    return {
      success: false,
      printerName: null,
      source: "none",
      usedFallback: false,
      error: errorMessage,
    };
  }
}

// ============================================
// Window Creation
// ============================================

function createMainWindow(): BrowserWindow {
  const iconPath = isDev
    ? path.join(__dirname, "..", "public", "eagle.png")
    : path.join(process.resourcesPath, "eagle.png");

  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    frame: false,
    title: "Freedom POS",
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // better-sqlite3 requires native modules
    },
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  win.setMenuBarVisibility(false);

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  return win;
}

// ============================================
// IPC Handlers
// ============================================

/**
 * Wraps an IPC handler so that uncaught exceptions are returned as
 * structured error objects instead of crashing the renderer with a
 * cryptic "An object could not be cloned" message.
 */
function safeHandle(
  channel: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any,
): void {
  ipcMain.handle(channel, async (event, ...args: unknown[]) => {
    try {
      return await handler(event, ...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
      console.error(`[IPC ${channel}] Error:`, err);
      throw new Error(message);
    }
  });
}

/**
 * Like `safeHandle`, but validates incoming arguments against a Zod
 * schema before forwarding to the handler. Returns a clear error to
 * the renderer if validation fails.
 */
function validatedHandle<T extends unknown[]>(
  channel: string,
  schema: ZodType<T>,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: T) => unknown,
): void {
  safeHandle(channel, (event, ...rawArgs: unknown[]) => {
    const parsed = schema.safeParse(rawArgs);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new Error(`[IPC ${channel}] Invalid arguments — ${detail}`);
    }
    return handler(event, ...parsed.data);
  });
}

function resolveDataScope(rawScope: unknown): DataScope {
  const parsed = V.DataScopeSchema.safeParse(rawScope ?? "system");
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new Error(`Invalid data scope: ${detail}`);
  }
  return parsed.data;
}

function registerIpcHandlers(): void {
  // ---- App ----
  ipcMain.handle("app:getVersion", () => app.getVersion());
  ipcMain.handle("app:getPlatform", () => process.platform);
  ipcMain.handle("window:minimize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.minimize();
  });
  ipcMain.handle("window:toggleMaximize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return false;
    }

    if (window.isMaximized()) {
      window.unmaximize();
      return false;
    }

    window.maximize();
    return true;
  });
  ipcMain.handle("window:close", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
  });
  ipcMain.handle("window:isMaximized", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window?.isMaximized() ?? false;
  });
  ipcMain.handle("window:toggleFullscreen", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return false;
    }

    const nextFullscreenState = !window.isFullScreen();
    window.setFullScreen(nextFullscreenState);
    return nextFullscreenState;
  });
  ipcMain.handle("window:isFullscreen", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window?.isFullScreen() ?? false;
  });
  ipcMain.handle(
    "app:printHtml",
    async (_e, html: string, options?: PrintHtmlOptions) => {
      try {
        return await withHiddenPrintWindow(async (printWindow) => {
          await loadHtmlIntoPrintWindow(printWindow, html);

          const installedPrinters = mapInstalledPrinters(
            await printWindow.webContents.getPrintersAsync(),
          );
          const deviceName = resolvePrinterDeviceName(
            installedPrinters,
            options,
          );
          const requestedPrinterNames = [
            options?.printerName,
            ...(options?.printerNameCandidates ?? []),
          ].filter((name): name is string => Boolean(name?.trim()));

          if (requestedPrinterNames.length > 0 && !deviceName) {
            console.warn(
              "[print] Requested printer was not found. Falling back to default printer silently.",
              requestedPrinterNames,
            );
          }

          const printResult = await runPrintJob(printWindow, {
            silent: options?.silent === true,
            deviceName,
            pageSizeMicrons: options?.pageSizeMicrons,
          });

          if (!printResult.success) {
            console.error(
              "[print] Generic print failed:",
              printResult.failureReason,
            );
          }

          return printResult.success;
        });
      } catch (error) {
        console.error("[print] Failed to load print document:", error);
        return false;
      }
    },
  );

  // ---- Printers ----
  ipcMain.handle("printers:list", async (): Promise<PrinterListResult> => {
    const userOverride = sanitizePrinterName(
      settingsService.getSettings().receiptPrinterName,
    );

    try {
      const installedPrinters = await listInstalledPrinters();
      return buildPrinterListResult(installedPrinters, userOverride);
    } catch (error) {
      console.error("[print] Failed to list installed printers:", error);
      return {
        printers: [],
        userOverride,
        recommendedPrinterName: null,
        selectedPrinterName: null,
        defaultPrinterName: null,
        xp80cAvailable: false,
      };
    }
  });
  ipcMain.handle(
    "printers:printReceipt",
    async (
      _e,
      html: string,
      options?: ReceiptPrintOptions,
    ): Promise<ReceiptPrintResult> => {
      return printReceiptSilently(html, options);
    },
  );
  ipcMain.handle(
    "printers:printTestReceipt",
    async (_e, options?: ReceiptPrintOptions): Promise<ReceiptPrintResult> => {
      return printReceiptSilently(buildTestReceiptHtml(), options);
    },
  );

  // ---- Auth ----
  validatedHandle("auth:login", V.AuthLoginSchema, (_e, email, password) => {
    return usersService.authenticateUser(email, password);
  });
  validatedHandle("auth:logout", V.AuthLogoutSchema, (_e, userId, shiftId) => {
    return usersService.logoutUserSession(userId, shiftId);
  });

  // ---- Users ----
  safeHandle("users:list", () => usersService.listUsers());
  validatedHandle("users:listPaged", V.PagedQuerySchema, (_e, query) =>
    usersService.listUsersPaged(query),
  );
  validatedHandle("users:getById", V.UserIdSchema, (_e, id) =>
    usersService.getUserById(id),
  );
  validatedHandle("users:getActivityById", V.UserIdSchema, (_e, id) =>
    usersService.getUserActivityById(id),
  );
  validatedHandle("users:getShiftOperations", V.UserIdSchema, (_e, shiftId) =>
    usersService.getUserShiftOperations(shiftId),
  );
  validatedHandle("users:create", V.CreateUserSchema, (_e, data) =>
    usersService.createUser(data),
  );
  validatedHandle("users:update", V.UpdateUserSchema, (_e, id, data) =>
    usersService.updateUser(id, data),
  );
  validatedHandle("users:delete", V.UserIdSchema, (_e, id) =>
    usersService.deleteUser(id),
  );

  // ---- Categories ----
  safeHandle("categories:list", () => categoriesService.listCategories());
  validatedHandle("categories:getById", V.CategoryIdSchema, (_e, id) =>
    categoriesService.getCategoryById(id),
  );
  validatedHandle("categories:create", V.CreateCategorySchema, (_e, data) =>
    categoriesService.createCategory(data),
  );
  validatedHandle("categories:update", V.UpdateCategorySchema, (_e, id, data) =>
    categoriesService.updateCategory(id, data),
  );
  validatedHandle("categories:delete", V.CategoryIdSchema, (_e, id) =>
    categoriesService.deleteCategory(id),
  );
  safeHandle("categories:deleteAll", () =>
    categoriesService.deleteAllCategories(),
  );

  // ---- Products ----
  safeHandle("products:list", (_e, activeOnly?: boolean) =>
    productsService.listProducts(activeOnly),
  );
  safeHandle("products:listLite", (_e, activeOnly?: boolean) =>
    productsService.listProductsLite(activeOnly),
  );
  validatedHandle("products:listPaged", V.PagedQuerySchema, (_e, query) =>
    productsService.listProductsPaged(query),
  );
  validatedHandle("products:getById", V.ProductIdSchema, (_e, id) =>
    productsService.getProductById(id),
  );
  validatedHandle(
    "products:getByBarcode",
    V.ProductBarcodeSchema,
    (_e, barcode) => productsService.getProductByBarcode(barcode),
  );
  validatedHandle("products:create", V.CreateProductSchema, (_e, data) =>
    productsService.createProduct(data),
  );
  validatedHandle("products:update", V.UpdateProductSchema, (_e, id, data) =>
    productsService.updateProduct(id, data),
  );
  validatedHandle("products:delete", V.ProductIdSchema, (_e, id) =>
    productsService.deleteProduct(id),
  );
  safeHandle("products:deleteAll", () => productsService.deleteAllProducts());

  // ---- Customers ----
  safeHandle("customers:list", () => customersService.listCustomers());
  validatedHandle("customers:listPaged", V.PagedQuerySchema, (_e, query) =>
    customersService.listCustomersPaged(query),
  );
  validatedHandle("customers:getById", V.CustomerIdSchema, (_e, id) =>
    customersService.getCustomerById(id),
  );
  validatedHandle("customers:create", V.CreateCustomerSchema, (_e, data) =>
    customersService.createCustomer(data),
  );
  validatedHandle("customers:update", V.UpdateCustomerSchema, (_e, id, data) =>
    customersService.updateCustomer(id, data),
  );
  validatedHandle("customers:delete", V.CustomerIdSchema, (_e, id) =>
    customersService.deleteCustomer(id),
  );
  safeHandle("customers:deleteAll", () =>
    customersService.deleteAllCustomers(),
  );

  // ---- Suppliers ----
  safeHandle("suppliers:list", () => suppliersService.listSuppliers());
  validatedHandle("suppliers:listPaged", V.PagedQuerySchema, (_e, query) =>
    suppliersService.listSuppliersPaged(query),
  );
  validatedHandle("suppliers:getById", V.SupplierIdSchema, (_e, id) =>
    suppliersService.getSupplierById(id),
  );
  validatedHandle("suppliers:create", V.CreateSupplierSchema, (_e, data) =>
    suppliersService.createSupplier(data),
  );
  validatedHandle("suppliers:update", V.UpdateSupplierSchema, (_e, id, data) =>
    suppliersService.updateSupplier(id, data),
  );
  validatedHandle("suppliers:delete", V.SupplierIdSchema, (_e, id) =>
    suppliersService.deleteSupplier(id),
  );
  safeHandle("suppliers:deleteAll", () =>
    suppliersService.deleteAllSuppliers(),
  );
  validatedHandle("suppliers:listOperations", V.SupplierIdSchema, (_e, id) =>
    suppliersService.listSupplierOperations(id),
  );
  validatedHandle(
    "suppliers:createOperation",
    V.CreateSupplierOperationSchema,
    (_e, data) => suppliersService.createSupplierOperation(data),
  );
  validatedHandle(
    "suppliers:settleDebt",
    V.SettleSupplierDebtSchema,
    (_e, data) => suppliersService.settleSupplierDebt(data),
  );
  validatedHandle(
    "suppliers:settleDebtAll",
    V.SettleSupplierDebtAllSchema,
    (_e, supplierId, note) =>
      suppliersService.settleSupplierDebtAll(supplierId, note),
  );

  // ---- Sales ----
  safeHandle("sales:list", (_e, query) => salesService.listSales(query));
  validatedHandle("sales:listPaged", V.PagedQuerySchema, (_e, query) =>
    salesService.listSalesPaged(query),
  );
  safeHandle("sales:listTimelinePaged", (_e, query) =>
    salesService.listSalesTimelinePaged(query),
  );
  validatedHandle("sales:getById", V.SaleIdSchema, (_e, id) =>
    salesService.getSaleById(id),
  );
  validatedHandle("sales:create", V.CreateSaleSchema, (_e, data) =>
    salesService.createSale(data),
  );
  validatedHandle("sales:update", V.UpdateSaleSchema, (_e, id, data) =>
    salesService.updateSale(id, data),
  );
  validatedHandle(
    "sales:updateStatus",
    V.UpdateSaleStatusSchema,
    (_e, id, status) => salesService.updateSaleStatus(id, status),
  );
  validatedHandle("sales:refund", V.RefundSaleSchema, (_e, data) =>
    salesService.refundSale(data),
  );
  validatedHandle("sales:delete", V.SaleIdSchema, (_e, id) =>
    salesService.deleteSale(id),
  );
  safeHandle("sales:deleteAll", () => salesService.deleteAllSales());

  // ---- Returns ----
  safeHandle("returns:list", (_e, query) => returnsService.listReturns(query));
  validatedHandle("returns:listPaged", V.PagedQuerySchema, (_e, query) =>
    returnsService.listReturnsPaged(query),
  );
  validatedHandle("returns:getById", V.ReturnIdSchema, (_e, id) =>
    returnsService.getReturnById(id),
  );
  validatedHandle("returns:create", V.CreateReturnSchema, (_e, data) =>
    returnsService.createReturn(data),
  );
  validatedHandle(
    "returns:createBatch",
    V.CreateReturnsBatchSchema,
    (_e, data) => returnsService.createReturnsBatch(data),
  );
  validatedHandle(
    "returns:updateStatus",
    V.UpdateReturnStatusSchema,
    (_e, id, status) => returnsService.updateReturnStatus(id, status),
  );
  validatedHandle("returns:delete", V.ReturnIdSchema, (_e, id) =>
    returnsService.deleteReturn(id),
  );
  safeHandle("returns:deleteAll", () => returnsService.deleteAllReturns());

  // ---- Treasury ----
  safeHandle("treasury:getSummary", () => treasuryService.getTreasurySummary());
  safeHandle("treasury:listOps", () => treasuryService.listTreasuryOps());
  validatedHandle("treasury:createOp", V.CreateTreasuryOpSchema, (_e, data) =>
    treasuryService.createTreasuryOp(data),
  );
  validatedHandle("treasury:deleteOp", V.TreasuryOpIdSchema, (_e, id) =>
    treasuryService.deleteTreasuryOp(id),
  );
  safeHandle("treasury:deleteAllOps", () =>
    treasuryService.deleteAllTreasuryOps(),
  );

  // ---- Reports ----
  safeHandle("reports:getNetRevenue", (_e, query) =>
    reportsService.getReportsNetRevenue(query),
  );
  safeHandle("reports:getSummary", (_e, query) =>
    reportsService.getReportsSummary(query),
  );

  // ---- Settings ----
  safeHandle("settings:get", () => settingsService.getSettings());
  validatedHandle("settings:update", V.UpdateSettingsSchema, (_e, data) =>
    settingsService.updateSettings(data),
  );
  validatedHandle("settings:resetData", V.ScopedDataSchema, (_e, scope) =>
    settingsService.resetData(scope),
  );
  safeHandle("settings:resetOperations", () =>
    settingsService.resetOperationsData(),
  );
  ipcMain.handle(
    "settings:getAutoBackupStatus",
    (): AutoBackupStatus => ({
      enabled: true,
      intervalMs: AUTO_BACKUP_INTERVAL_MS,
      backupDirectory: backupService.getSuggestedBackupDirectory(),
      lastBackupAt: lastAutoBackupAt?.toISOString() ?? null,
      nextBackupAt: nextAutoBackupAt?.toISOString() ?? null,
    }),
  );
  ipcMain.handle(
    "settings:createBackup",
    async (event, rawScope?: unknown): Promise<DataBackupResult> => {
      const scope = resolveDataScope(rawScope);
      const parentWindow = BrowserWindow.fromWebContents(event.sender);
      const saveDialogOptions = {
        title: "إنشاء نسخة احتياطية",
        defaultPath: backupService.getSuggestedBackupPath(scope),
        buttonLabel: "حفظ النسخة",
        filters: [
          {
            name: "SQLite Backup",
            extensions: ["db", "sqlite", "sqlite3", "bak", "backup"],
          },
        ],
      } satisfies Electron.SaveDialogOptions;
      const saveResult = parentWindow
        ? await dialog.showSaveDialog(parentWindow, saveDialogOptions)
        : await dialog.showSaveDialog(saveDialogOptions);

      if (saveResult.canceled || !saveResult.filePath) {
        return { canceled: true };
      }

      return backupService.createBackup(saveResult.filePath, scope);
    },
  );
  ipcMain.handle(
    "settings:createAutoBackup",
    async (_event, rawScope?: unknown): Promise<DataBackupResult> => {
      const scope = resolveDataScope(rawScope);
      const targetPath = backupService.getSuggestedBackupPath(scope);
      return backupService.createBackup(targetPath, scope);
    },
  );
  ipcMain.handle(
    "settings:restoreBackup",
    async (event, rawScope?: unknown): Promise<DataRestoreResult> => {
      const scope = resolveDataScope(rawScope);
      const parentWindow = BrowserWindow.fromWebContents(event.sender);
      const openDialogOptions = {
        title: "استعادة نسخة احتياطية",
        defaultPath: backupService.getSuggestedBackupDirectory(),
        buttonLabel: "استعادة",
        properties: ["openFile"],
        filters: [
          {
            name: "SQLite Backup",
            extensions: ["db", "sqlite", "sqlite3", "bak", "backup"],
          },
        ],
      } satisfies Electron.OpenDialogOptions;
      const openResult = parentWindow
        ? await dialog.showOpenDialog(parentWindow, openDialogOptions)
        : await dialog.showOpenDialog(openDialogOptions);

      if (openResult.canceled || openResult.filePaths.length === 0) {
        return { canceled: true };
      }

      return backupService.restoreBackup(openResult.filePaths[0], scope);
    },
  );

  // ---- Cloud Sync ----
  ipcMain.handle("cloud:getSettings", () => {
    const settings = settingsService.getSettings();
    return settings.cloudSync ?? {
      enabled: false,
      serverUrl: "",
      apiKey: "",
      syncInterval: 5,
      lastSyncAt: null,
      lastSyncStatus: null,
    };
  });
  ipcMain.handle("cloud:saveSettings", (_event, data) => {
    const settings = settingsService.getSettings();
    settings.cloudSync = { ...settings.cloudSync, ...data };
    settingsService.updateSettings({ cloudSync: settings.cloudSync });
    return { success: true };
  });
  ipcMain.handle("cloud:syncNow", async (_event) => {
    const settings = settingsService.getSettings();
    const cloud = settings.cloudSync;
    if (!cloud?.enabled || !cloud.serverUrl || !cloud.apiKey) {
      return { success: false, error: "Cloud sync is not configured" };
    }
    try {
      const db = getDb();
      const tables = [
        { table: "categories", action: "upsert", rows: db.prepare("SELECT * FROM categories").all() },
        { table: "products", action: "upsert", rows: db.prepare("SELECT * FROM products").all() },
        { table: "suppliers", action: "upsert", rows: db.prepare("SELECT * FROM suppliers").all() },
        { table: "sales", action: "upsert", rows: db.prepare("SELECT * FROM sales").all() },
        { table: "sale_items", action: "upsert", rows: db.prepare("SELECT * FROM sale_items").all() },
        { table: "returns", action: "upsert", rows: db.prepare("SELECT * FROM returns").all() },
        { table: "treasury_operations", action: "upsert", rows: db.prepare("SELECT * FROM treasury_ops").all() },
        { table: "user_shifts", action: "upsert", rows: db.prepare("SELECT * FROM user_shifts").all() },
        { table: "customers", action: "upsert", rows: db.prepare("SELECT * FROM customers").all() },
        { table: "users", action: "upsert", rows: db.prepare("SELECT * FROM users").all() },
      ];
      const body = { timestamp: new Date().toISOString(), posVersion: app.getVersion(), tables };
      const response = await fetch(`${cloud.serverUrl.replace(/\/+$/, "")}/api/sync/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cloud.apiKey}` },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      cloud.lastSyncAt = new Date().toISOString();
      cloud.lastSyncStatus = "success";
      settings.cloudSync = cloud;
      settingsService.updateSettings({ cloudSync: cloud });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      cloud.lastSyncStatus = "error";
      settings.cloudSync = cloud;
      settingsService.updateSettings({ cloudSync: cloud });
      return { success: false, error: message };
    }
  });
  ipcMain.handle("cloud:testConnection", async (_event, serverUrl: string, apiKey: string) => {
    try {
      const response = await fetch(`${serverUrl.replace(/\/+$/, "")}/api/health`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return { success: response.ok, error: response.ok ? undefined : `Server responded with ${response.status}` };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  });
}

// ============================================
// App Lifecycle – single-instance lock
// ============================================

let dataRetentionTimer: NodeJS.Timeout | null = null;
let dataRetentionStartTimer: NodeJS.Timeout | null = null;
let autoBackupTimer: NodeJS.Timeout | null = null;
let autoBackupStartTimer: NodeJS.Timeout | null = null;
let isDataRetentionRunning = false;
let isAutoBackupRunning = false;
let activeMaintenanceTask: "retention" | "backup" | null = null;
let lastAutoBackupAt: Date | null = null;
let nextAutoBackupAt: Date | null = null;

function runDataRetentionCleanup(trigger: "startup" | "interval"): void {
  if (isDataRetentionRunning || activeMaintenanceTask === "backup") {
    return;
  }
  isDataRetentionRunning = true;
  activeMaintenanceTask = "retention";

  try {
    const summary = dataRetentionService.runOperationalDataRetentionCleanup();
    const deletedTotal =
      summary.deletedSales +
      summary.deletedReturns +
      summary.deletedTreasuryOperations +
      summary.deletedUserShifts +
      summary.deletedSupplierOperations;

  } catch (error) {
    console.error("[Retention] Failed to run cleanup:", error);
  } finally {
    isDataRetentionRunning = false;
    if (activeMaintenanceTask === "retention") {
      activeMaintenanceTask = null;
    }
  }
}

function startDataRetentionCleanupLoop(): void {
  if (dataRetentionTimer || dataRetentionStartTimer) {
    return;
  }

  dataRetentionStartTimer = setTimeout(() => {
    dataRetentionStartTimer = null;
    runDataRetentionCleanup("startup");
    dataRetentionTimer = setInterval(() => {
      runDataRetentionCleanup("interval");
    }, DATA_RETENTION_CLEANUP_INTERVAL_MS);
    dataRetentionTimer.unref?.();
  }, DATA_RETENTION_INITIAL_DELAY_MS);
  dataRetentionStartTimer.unref?.();
}

function stopDataRetentionCleanupLoop(): void {
  if (dataRetentionStartTimer) {
    clearTimeout(dataRetentionStartTimer);
    dataRetentionStartTimer = null;
  }
  if (!dataRetentionTimer) {
    return;
  }
  clearInterval(dataRetentionTimer);
  dataRetentionTimer = null;
}

async function pruneOldAutoBackups(maxFiles: number): Promise<void> {
  const backupDirectory = backupService.getSuggestedBackupDirectory();
  const entries = await fs.readdir(backupDirectory, { withFileTypes: true });
  const files = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith(AUTO_BACKUP_FILE_PREFIX) &&
        entry.name.endsWith(".db"),
    )
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));

  if (files.length <= maxFiles) {
    return;
  }

  const staleFiles = files.slice(maxFiles);
  await Promise.all(
    staleFiles.map((fileName) =>
      fs.unlink(path.join(backupDirectory, fileName)).catch((error) => {
        console.warn(
          `[AutoBackup] Failed to remove old backup ${fileName}:`,
          error,
        );
      }),
    ),
  );
}

async function runScheduledAutoBackup(
  trigger: "startup" | "interval",
): Promise<void> {
  if (isAutoBackupRunning || activeMaintenanceTask === "retention") {
    return;
  }
  isAutoBackupRunning = true;
  activeMaintenanceTask = "backup";

  try {
    const targetPath = backupService.getSuggestedBackupPath(AUTO_BACKUP_SCOPE);
    const result = await backupService.createBackup(
      targetPath,
      AUTO_BACKUP_SCOPE,
    );
    if (result.canceled || !result.backupPath) {
      return;
    }

    await pruneOldAutoBackups(AUTO_BACKUP_MAX_FILES);
    lastAutoBackupAt = new Date();
  } catch (error) {
    console.error("[AutoBackup] Failed to create scheduled backup:", error);
  } finally {
    isAutoBackupRunning = false;
    if (activeMaintenanceTask === "backup") {
      activeMaintenanceTask = null;
    }
  }
}

function startAutoBackupLoop(): void {
  if (autoBackupTimer || autoBackupStartTimer) {
    return;
  }

  nextAutoBackupAt = new Date(Date.now() + AUTO_BACKUP_INITIAL_DELAY_MS);

  autoBackupStartTimer = setTimeout(() => {
    autoBackupStartTimer = null;
    void runScheduledAutoBackup("startup");
    nextAutoBackupAt = new Date(Date.now() + AUTO_BACKUP_INTERVAL_MS);
    autoBackupTimer = setInterval(() => {
      nextAutoBackupAt = new Date(Date.now() + AUTO_BACKUP_INTERVAL_MS);
      void runScheduledAutoBackup("interval");
    }, AUTO_BACKUP_INTERVAL_MS);
    autoBackupTimer.unref?.();
  }, AUTO_BACKUP_INITIAL_DELAY_MS);
  autoBackupStartTimer.unref?.();
}

function stopAutoBackupLoop(): void {
  if (autoBackupStartTimer) {
    clearTimeout(autoBackupStartTimer);
    autoBackupStartTimer = null;
  }
  if (!autoBackupTimer) {
    return;
  }
  clearInterval(autoBackupTimer);
  autoBackupTimer = null;
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance already holds the lock – quit immediately.
  app.quit();
} else {
  // A second instance was attempted – focus the existing window instead.
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    // Initialize database before anything else
    initDatabase();
    seedDatabase();

    registerIpcHandlers();
    createMainWindow();
    startDataRetentionCleanupLoop();
    startAutoBackupLoop();
    startSyncServer().catch((err) =>
      console.error("[sync] Failed to start sync server:", err)
    );

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });
}

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  stopDataRetentionCleanupLoop();
  stopAutoBackupLoop();
  stopSyncServer().finally(() => closeDatabase());
});
