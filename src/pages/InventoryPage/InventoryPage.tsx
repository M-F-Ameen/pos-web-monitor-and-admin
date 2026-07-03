import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavSidebar } from "../../components/layout/NavSidebar";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { TablePagination } from "../../components/ui/TablePagination";
import { SkeletonPatterns } from "../../components/ui/SkeletonLoader";
import {
  IconGrid,
  IconSearch,
  IconPlus,
  IconRefresh,
} from "../../components/ui/Icons";
import { isAppPage } from "../../app/access";
import { buildSidebarNavItems } from "../../app/appSidebarNav";
import { useAuth } from "../../app/AuthContext";
import {
  products as productsService,
  categories as categoriesService,
} from "../../services/db";
import type { Product, Category } from "../../services/db";
import { useDefaultImage } from "../../app/DefaultImageContext";
import "./InventoryPage.css";

interface InventoryForm {
  name: string;
  size: string;
  quantity: string;
  brand: string;
  price: string;
  barcode: string;
  categoryId: string;
  image: string;
}

const EMPTY_FORM: InventoryForm = {
  name: "",
  size: "",
  quantity: "",
  brand: "",
  price: "",
  barcode: "",
  categoryId: "",
  image: "",
};

const ITEMS_PER_PAGE = 13;

type ImportColumnKey =
  | "name"
  | "description"
  | "size"
  | "brand"
  | "price"
  | "cost"
  | "originalPrice"
  | "productCode"
  | "barcode"
  | "categoryName"
  | "categoryId"
  | "stock"
  | "minStock"
  | "isActive"
  | "image";

type ImportColumns = Map<ImportColumnKey, number>;

interface InventoryImportSummary {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  warnings: string[];
  errors: string[];
}

const IMPORT_COLUMN_LABELS: Record<ImportColumnKey, string> = {
  name: "اسم المنتج",
  description: "الوصف",
  size: "الحجم",
  brand: "العلامة التجارية",
  price: "السعر",
  cost: "التكلفة",
  originalPrice: "السعر الأصلي",
  productCode: "كود المنتج الداخلي (5 أرقام)",
  barcode: "الباركود",
  categoryName: "اسم التصنيف",
  categoryId: "معرف التصنيف",
  stock: "الكمية",
  minStock: "الحد الأدنى",
  isActive: "نشط",
  image: "الصورة",
};

const IMPORT_HEADER_ALIASES: Record<ImportColumnKey, string[]> = {
  name: ["name", "productname", "اسم", "اسمالمنتج", "الصنف", "اسمصنف"],
  description: ["description", "desc", "الوصف", "وصف"],
  size: ["size", "الحجم"],
  brand: ["brand", "العلامة", "العلامةالتجارية", "الماركة", "ماركة"],
  price: ["price", "unitprice", "السعر", "سعر"],
  cost: ["cost", "التكلفة"],
  originalPrice: [
    "originalprice",
    "السعرالاصلي",
    "السعرالأصلي",
    "السعرقبلالخصم",
  ],
  productCode: [
    "productcode",
    "product_code",
    "internalcode",
    "كود",
    "كودالمنتج",
    "الكودالداخلي",
  ],
  barcode: ["barcode", "sku", "الباركود", "باركود"],
  categoryName: ["categoryname", "category", "التصنيف", "اسمالتصنيف", "الفئة"],
  categoryId: ["categoryid", "معرفالتصنيف"],
  stock: ["stock", "quantity", "qty", "الكمية", "كمية", "المخزون"],
  minStock: ["minstock", "minimumstock", "الحدالادنى", "الحدالأدنى", "حدادنى"],
  isActive: ["isactive", "active", "نشط", "فعال"],
  image: ["image", "imageurl", "الصورة", "رابطالصورة"],
};

const IMPORT_REQUIRED_COLUMNS: ImportColumnKey[] = ["name", "price", "stock"];

const CSV_EXPORT_HEADERS: ImportColumnKey[] = [
  "name",
  "description",
  "size",
  "brand",
  "price",
  "cost",
  "originalPrice",
  "productCode",
  "barcode",
  "categoryName",
  "categoryId",
  "stock",
  "minStock",
  "isActive",
  "image",
];

type XlsxModule = typeof import("xlsx");

let xlsxModulePromise: Promise<XlsxModule> | null = null;

function loadXlsxModule(): Promise<XlsxModule> {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import("xlsx");
  }
  return xlsxModulePromise;
}

function toPrice(value: string): number {
  return Number(value.trim());
}

function toQuantity(value: string): number {
  return Number(value.trim());
}

function normalizeCsvHeader(value: string): string {
  return value
    .trim()
    .replaceAll("\uFEFF", "")
    .toLowerCase()
    .replace(/[\s_\-()/]+/g, "");
}

function normalizeMatchValue(value: string): string {
  return value.trim().toLowerCase();
}

function buildProductMatchKey(
  name: string,
  brand: string,
  size: string,
): string {
  return [
    normalizeMatchValue(name),
    normalizeMatchValue(brand),
    normalizeMatchValue(size),
  ].join("|");
}

function formatExportTimestamp(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}${month}${day}_${hours}${minutes}`;
}

function buildProductsSheetRows(
  products: Product[],
  categoryNameById: Map<string, string>,
): Array<Array<string | number>> {
  const headerRow = CSV_EXPORT_HEADERS.map(
    (column) => IMPORT_COLUMN_LABELS[column],
  );
  const dataRows = products.map((product) => [
    product.name,
    product.description,
    product.size,
    product.brand,
    product.price,
    product.cost,
    product.originalPrice,
    product.productCode,
    product.barcode,
    categoryNameById.get(product.categoryId) ?? "",
    product.categoryId,
    product.stock,
    product.minStock,
    product.isActive ? "نعم" : "لا",
    product.image,
  ]);
  return [headerRow, ...dataRows];
}

async function triggerXlsxDownload(
  rows: Array<Array<string | number>>,
  fileName: string,
): Promise<void> {
  const { utils: xlsxUtils, write: xlsxWrite } = await loadXlsxModule();
  const worksheet = xlsxUtils.aoa_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 28 }, // name
    { wch: 26 }, // description
    { wch: 14 }, // size
    { wch: 18 }, // brand
    { wch: 12 }, // price
    { wch: 12 }, // cost
    { wch: 14 }, // original price
    { wch: 16 }, // product code
    { wch: 18 }, // barcode
    { wch: 18 }, // category name
    { wch: 20 }, // category id
    { wch: 10 }, // stock
    { wch: 12 }, // min stock
    { wch: 10 }, // active
    { wch: 36 }, // image
  ];

  const workbook = xlsxUtils.book_new();
  xlsxUtils.book_append_sheet(workbook, worksheet, "Products");
  const arrayBuffer = xlsxWrite(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildImportTemplateSheetRows(): Array<Array<string | number>> {
  const header = CSV_EXPORT_HEADERS.map(
    (column) => IMPORT_COLUMN_LABELS[column],
  );
  const sampleRow: Array<string | number> = [
    "منتج تجريبي",
    "وصف اختياري",
    "علبة",
    "Brand",
    10.5,
    0,
    0,
    "يولد تلقائيًا",
    "1234567890123",
    "بدون تصنيف",
    "",
    25,
    5,
    "نعم",
    "",
  ];
  return [header, sampleRow];
}

function isExcelFileName(fileName: string): boolean {
  const lowerCaseName = fileName.trim().toLowerCase();
  return lowerCaseName.endsWith(".xlsx") || lowerCaseName.endsWith(".xls");
}

async function parseImportFileRows(selectedFile: File): Promise<string[][]> {
  if (isExcelFileName(selectedFile.name)) {
    const { read: xlsxRead, utils: xlsxUtils } = await loadXlsxModule();
    const workbookData = await selectedFile.arrayBuffer();
    const workbook = xlsxRead(workbookData, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error("ملف Excel لا يحتوي على أي ورقة.");
    }

    const firstSheet = workbook.Sheets[firstSheetName];
    if (!firstSheet) {
      throw new Error("تعذر قراءة ورقة Excel الأولى.");
    }

    const parsedRows = xlsxUtils.sheet_to_json<(string | number | boolean)[]>(
      firstSheet,
      {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
      },
    );

    return parsedRows
      .map((row) => row.map((cell) => String(cell ?? "")))
      .filter((row) => row.length > 0);
  }

  const raw = await selectedFile.text();
  if (!raw.trim()) {
    throw new Error("الملف فارغ.");
  }

  const delimiter = detectCsvDelimiter(raw);
  return parseDelimitedCsv(raw, delimiter).filter((row) => row.length > 0);
}

function detectCsvDelimiter(raw: string): "," | ";" {
  const firstLine = raw.split(/\r?\n/, 1)[0] ?? "";
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseDelimitedCsv(raw: string, delimiter: "," | ";"): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const nextChar = raw[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";

      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function buildImportColumns(headers: string[]): ImportColumns {
  const columns: ImportColumns = new Map();

  headers.forEach((header, index) => {
    const normalized = normalizeCsvHeader(header);
    const matched = (
      Object.entries(IMPORT_HEADER_ALIASES) as [ImportColumnKey, string[]][]
    ).find(([, aliases]) => aliases.includes(normalized));
    if (matched && !columns.has(matched[0])) {
      columns.set(matched[0], index);
    }
  });

  return columns;
}

function parseFlexibleNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const cleaned = trimmed.replace(/\s+/g, "").replace(/[^\d,.\-]/g, "");
  if (!cleaned) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;

  if (hasComma && !hasDot) {
    normalized = cleaned.replaceAll(",", ".");
  } else if (hasComma && hasDot) {
    normalized = cleaned.replaceAll(",", "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBooleanValue(raw: string): boolean | null {
  const normalized = normalizeMatchValue(raw);
  if (!normalized) return null;

  if (
    ["true", "1", "yes", "y", "on", "active", "نشط", "فعال", "نعم"].includes(
      normalized,
    )
  ) {
    return true;
  }
  if (
    [
      "false",
      "0",
      "no",
      "n",
      "off",
      "inactive",
      "غيرنشط",
      "غيرفعال",
      "لا",
    ].includes(normalized)
  ) {
    return false;
  }
  return null;
}

export function InventoryPage() {
  const navigate = useNavigate();
  const { role, logout } = useAuth();
  const defaultImage = useDefaultImage();
  const canManage = role === "admin";
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalInventoryValue, setTotalInventoryValue] = useState("0.00");
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<InventoryForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pageMessage, setPageMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pagedResult, categoriesList] = await Promise.all([
        productsService.listPaged({
          page: currentPage,
          pageSize: ITEMS_PER_PAGE,
          search: debouncedSearch || undefined,
        }),
        categoriesService.list(),
      ]);
      setItems(pagedResult.items);
      setTotalCount(pagedResult.totalCount);
      setTotalPages(pagedResult.totalPages);
      setTotalInventoryValue(pagedResult.totalValue.toFixed(2));
      setCategories(categoriesList);
    } catch (err) {
      console.error("Failed to load inventory data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const editingProductCode = useMemo(() => {
    if (!editingId) {
      return "";
    }
    return items.find((item) => item.id === editingId)?.productCode ?? "";
  }, [editingId, items]);

  useEffect(() => {
    setCurrentPage((previous) => Math.min(previous, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!pageMessage) return;
    const timeoutId = window.setTimeout(() => setPageMessage(null), 6000);
    return () => window.clearTimeout(timeoutId);
  }, [pageMessage]);

  function handleChange(field: keyof InventoryForm, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (error) {
      setError("");
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError("");
    setImagePreview("");
  }

  function closeModal() {
    setIsModalOpen(false);
    resetForm();
  }

  function openAddModal() {
    if (!canManage) return;
    resetForm();
    setIsModalOpen(true);
  }

  function openEditModal(item: Product) {
    if (!canManage) return;
    setEditingId(item.id);
    setForm({
      name: item.name,
      size: item.size,
      quantity: item.stock.toString(),
      brand: item.brand,
      price: item.price.toString(),
      barcode: item.barcode,
      categoryId: item.categoryId,
      image: item.image,
    });
    setImagePreview(item.image || defaultImage);
    setError("");
    setIsModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (!canManage) return;
    try {
      const deleted = await productsService.delete(id);
      if (!deleted) {
        throw new Error("تعذر حذف المنتج.");
      }
      if (editingId === id) {
        closeModal();
      }
      await loadData();
      setPageMessage({
        type: "success",
        text: "تم حذف المنتج بنجاح.",
      });
    } catch (deleteError) {
      const details =
        deleteError instanceof Error ? ` (${deleteError.message})` : "";
      setPageMessage({
        type: "error",
        text: `فشل حذف المنتج.${details}`,
      });
    }
  }

  async function handleDuplicate(item: Product) {
    if (!canManage) return;
    try {
      const created = await productsService.create({
        name: `${item.name} (نسخة)`,
        size: item.size,
        brand: item.brand,
        price: item.price,
        stock: item.stock,
        barcode: "",
        categoryId: item.categoryId,
        image: item.image,
      });
      if (!created) {
        throw new Error("تعذر إنشاء نسخة من المنتج.");
      }
      await loadData();
      setPageMessage({
        type: "success",
        text: `تم إنشاء نسخة جديدة من المنتج. الكود الداخلي: ${created.productCode}`,
      });
    } catch (duplicateError) {
      const details =
        duplicateError instanceof Error ? ` (${duplicateError.message})` : "";
      setPageMessage({
        type: "error",
        text: `فشل نسخ المنتج.${details}`,
      });
    }
  }

  function openImportDialog() {
    if (!canManage) {
      return;
    }
    if (isImporting || isExporting || isSubmitting) {
      return;
    }
    importFileInputRef.current?.click();
  }

  async function exportProductsToExcel() {
    if (totalCount === 0) {
      setPageMessage({
        type: "error",
        text: "لا توجد منتجات للتصدير.",
      });
      return;
    }

    setIsExporting(true);
    setPageMessage(null);
    try {
      const allProducts = await productsService.list();
      const rows = buildProductsSheetRows(allProducts, categoryNameById);
      const fileName = `products_export_${formatExportTimestamp()}.xlsx`;
      await triggerXlsxDownload(rows, fileName);
      setPageMessage({
        type: "success",
        text: `تم تصدير ${allProducts.length} منتج إلى ملف Excel منظم.`,
      });
    } catch (exportError) {
      const details =
        exportError instanceof Error ? ` (${exportError.message})` : "";
      setPageMessage({
        type: "error",
        text: `فشل تصدير المنتجات.${details}`,
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function downloadImportTemplate() {
    try {
      const rows = buildImportTemplateSheetRows();
      const fileName = `products_import_template_${formatExportTimestamp()}.xlsx`;
      await triggerXlsxDownload(rows, fileName);
      setPageMessage({
        type: "success",
        text: "تم تنزيل قالب الاستيراد Excel بنجاح.",
      });
    } catch (downloadError) {
      const details =
        downloadError instanceof Error ? ` (${downloadError.message})` : "";
      setPageMessage({
        type: "error",
        text: `فشل تنزيل قالب الاستيراد.${details}`,
      });
    }
  }

  async function importProductsFromRows(
    rows: string[][],
    columns: ImportColumns,
  ): Promise<InventoryImportSummary> {
    const summary: InventoryImportSummary = {
      totalRows: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      warnings: [],
      errors: [],
    };

    const warningsLimit = 15;
    const errorsLimit = 15;

    const categoriesByName = new Map(
      categories.map((category) => [
        normalizeMatchValue(category.name),
        category.id,
      ]),
    );
    const categoriesById = new Set(categories.map((category) => category.id));

    // Import matching must use the full catalog, not the currently paginated UI rows.
    const existingProducts = await productsService.list();
    const productsByBarcode = new Map<string, Product>();
    const productsByCompositeKey = new Map<string, Product>();
    for (const product of existingProducts) {
      if (product.barcode.trim()) {
        productsByBarcode.set(normalizeMatchValue(product.barcode), product);
      }
      productsByCompositeKey.set(
        buildProductMatchKey(product.name, product.brand, product.size),
        product,
      );
    }

    const hasColumn = (column: ImportColumnKey) => columns.has(column);
    const readCell = (
      row: string[],
      column: ImportColumnKey,
    ): string | undefined => {
      const index = columns.get(column);
      if (index === undefined) return undefined;
      return (row[index] ?? "").trim();
    };

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const rowNumber = rowIndex + 2;

      if (row.every((cell) => !cell || !cell.trim())) {
        continue;
      }
      summary.totalRows += 1;

      const name = (readCell(row, "name") ?? "").trim();
      const priceRaw = readCell(row, "price") ?? "";
      const stockRaw = readCell(row, "stock") ?? "";

      if (!name) {
        summary.skipped += 1;
        if (summary.errors.length < errorsLimit) {
          summary.errors.push(`السطر ${rowNumber}: اسم المنتج مطلوب.`);
        }
        continue;
      }

      const parsedPrice = parseFlexibleNumber(priceRaw);
      if (parsedPrice === null || parsedPrice <= 0) {
        summary.skipped += 1;
        if (summary.errors.length < errorsLimit) {
          summary.errors.push(`السطر ${rowNumber}: السعر غير صالح.`);
        }
        continue;
      }

      const parsedStock = parseFlexibleNumber(stockRaw);
      if (
        parsedStock === null ||
        parsedStock < 0 ||
        !Number.isInteger(parsedStock)
      ) {
        summary.skipped += 1;
        if (summary.errors.length < errorsLimit) {
          summary.errors.push(
            `السطر ${rowNumber}: الكمية يجب أن تكون رقماً صحيحاً 0 أو أكبر.`,
          );
        }
        continue;
      }

      const barcode = (readCell(row, "barcode") ?? "").trim();
      const description = (readCell(row, "description") ?? "").trim();
      const size = (readCell(row, "size") ?? "").trim();
      const brand = (readCell(row, "brand") ?? "").trim();
      const image = (readCell(row, "image") ?? "").trim();
      const categoryIdRaw = (readCell(row, "categoryId") ?? "").trim();
      const categoryNameRaw = (readCell(row, "categoryName") ?? "").trim();

      const costRaw = readCell(row, "cost");
      const originalPriceRaw = readCell(row, "originalPrice");
      const minStockRaw = readCell(row, "minStock");
      const isActiveRaw = readCell(row, "isActive");

      const parsedCost =
        costRaw && costRaw.trim() ? parseFlexibleNumber(costRaw) : null;
      const parsedOriginalPrice =
        originalPriceRaw && originalPriceRaw.trim()
          ? parseFlexibleNumber(originalPriceRaw)
          : null;
      const parsedMinStock =
        minStockRaw && minStockRaw.trim()
          ? parseFlexibleNumber(minStockRaw)
          : null;
      const parsedIsActive =
        isActiveRaw && isActiveRaw.trim()
          ? parseBooleanValue(isActiveRaw)
          : null;

      if (parsedCost !== null && parsedCost < 0) {
        summary.skipped += 1;
        if (summary.errors.length < errorsLimit) {
          summary.errors.push(
            `السطر ${rowNumber}: التكلفة لا يمكن أن تكون سالبة.`,
          );
        }
        continue;
      }
      if (parsedOriginalPrice !== null && parsedOriginalPrice < 0) {
        summary.skipped += 1;
        if (summary.errors.length < errorsLimit) {
          summary.errors.push(
            `السطر ${rowNumber}: السعر الأصلي لا يمكن أن يكون سالباً.`,
          );
        }
        continue;
      }
      if (
        parsedMinStock !== null &&
        (parsedMinStock < 0 || !Number.isInteger(parsedMinStock))
      ) {
        summary.skipped += 1;
        if (summary.errors.length < errorsLimit) {
          summary.errors.push(
            `السطر ${rowNumber}: الحد الأدنى يجب أن يكون عدداً صحيحاً 0 أو أكبر.`,
          );
        }
        continue;
      }
      if (isActiveRaw && isActiveRaw.trim() && parsedIsActive === null) {
        summary.skipped += 1;
        if (summary.errors.length < errorsLimit) {
          summary.errors.push(
            `السطر ${rowNumber}: قيمة "نشط" غير مفهومة. استخدم true/false أو 1/0.`,
          );
        }
        continue;
      }

      let resolvedCategoryId = "";
      if (categoryIdRaw) {
        if (categoriesById.has(categoryIdRaw)) {
          resolvedCategoryId = categoryIdRaw;
        } else if (summary.warnings.length < warningsLimit) {
          summary.warnings.push(
            `السطر ${rowNumber}: لم يتم العثور على معرف التصنيف "${categoryIdRaw}" وتم الاستيراد بدون تصنيف.`,
          );
        }
      } else if (categoryNameRaw) {
        const byName = categoriesByName.get(
          normalizeMatchValue(categoryNameRaw),
        );
        if (byName) {
          resolvedCategoryId = byName;
        } else if (summary.warnings.length < warningsLimit) {
          summary.warnings.push(
            `السطر ${rowNumber}: التصنيف "${categoryNameRaw}" غير موجود وتم الاستيراد بدون تصنيف.`,
          );
        }
      }

      const barcodeKey = normalizeMatchValue(barcode);
      const compositeKey = buildProductMatchKey(name, brand, size);

      let existing = barcodeKey ? productsByBarcode.get(barcodeKey) : undefined;
      if (!existing) {
        existing = productsByCompositeKey.get(compositeKey);
      }

      if (existing) {
        const updatePayload: Record<string, unknown> = {
          name,
          price: parsedPrice,
          stock: parsedStock,
        };

        if (hasColumn("description")) updatePayload.description = description;
        if (hasColumn("size")) updatePayload.size = size;
        if (hasColumn("brand")) updatePayload.brand = brand;
        if (hasColumn("barcode")) updatePayload.barcode = barcode;
        if (hasColumn("image")) updatePayload.image = image || defaultImage;
        if (hasColumn("categoryId") || hasColumn("categoryName")) {
          updatePayload.categoryId = resolvedCategoryId;
        }
        if (hasColumn("cost") && parsedCost !== null)
          updatePayload.cost = parsedCost;
        if (hasColumn("originalPrice") && parsedOriginalPrice !== null) {
          updatePayload.originalPrice = parsedOriginalPrice;
        }
        if (hasColumn("minStock") && parsedMinStock !== null) {
          updatePayload.minStock = parsedMinStock;
        }
        if (hasColumn("isActive") && parsedIsActive !== null) {
          updatePayload.isActive = parsedIsActive;
        }

        const updated = await productsService.update(
          existing.id,
          updatePayload,
        );
        const effectiveProduct = (updated ?? {
          ...existing,
          ...updatePayload,
        }) as Product;

        summary.updated += 1;
        productsByCompositeKey.set(
          buildProductMatchKey(
            effectiveProduct.name,
            effectiveProduct.brand,
            effectiveProduct.size,
          ),
          effectiveProduct,
        );
        if (effectiveProduct.barcode.trim()) {
          productsByBarcode.set(
            normalizeMatchValue(effectiveProduct.barcode),
            effectiveProduct,
          );
        }
        continue;
      }

      const createPayload: Record<string, unknown> = {
        name,
        description: hasColumn("description") ? description : "",
        size: hasColumn("size") ? size : "",
        brand: hasColumn("brand") ? brand : "",
        price: parsedPrice,
        barcode: hasColumn("barcode") ? barcode : "",
        categoryId: resolvedCategoryId,
        stock: parsedStock,
        image: hasColumn("image") ? image || defaultImage : defaultImage,
      };
      if (hasColumn("cost") && parsedCost !== null)
        createPayload.cost = parsedCost;
      if (hasColumn("originalPrice") && parsedOriginalPrice !== null) {
        createPayload.originalPrice = parsedOriginalPrice;
      }
      if (hasColumn("minStock") && parsedMinStock !== null) {
        createPayload.minStock = parsedMinStock;
      }
      if (hasColumn("isActive") && parsedIsActive !== null) {
        createPayload.isActive = parsedIsActive;
      }

      const created = await productsService.create(createPayload);
      if (!created) {
        summary.skipped += 1;
        if (summary.errors.length < errorsLimit) {
          summary.errors.push(`السطر ${rowNumber}: تعذر إنشاء المنتج.`);
        }
        continue;
      }

      summary.created += 1;
      productsByCompositeKey.set(
        buildProductMatchKey(created.name, created.brand, created.size),
        created,
      );
      if (created.barcode.trim()) {
        productsByBarcode.set(normalizeMatchValue(created.barcode), created);
      }
    }

    return summary;
  }

  async function handleImportFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    if (!canManage) {
      event.target.value = "";
      return;
    }
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setIsImporting(true);
    setPageMessage(null);

    try {
      const parsedRows = await parseImportFileRows(selectedFile);
      if (parsedRows.length <= 1) {
        throw new Error("الملف لا يحتوي على صفوف بيانات.");
      }

      const headers = parsedRows[0];
      const columns = buildImportColumns(headers);

      const missingRequired = IMPORT_REQUIRED_COLUMNS.filter(
        (column) => !columns.has(column),
      );
      if (missingRequired.length > 0) {
        const label = missingRequired
          .map((column) => IMPORT_COLUMN_LABELS[column])
          .join("، ");
        throw new Error(`الأعمدة الإلزامية مفقودة: ${label}`);
      }

      const summary = await importProductsFromRows(
        parsedRows.slice(1),
        columns,
      );
      await loadData();

      const firstIssue = summary.errors[0] ?? summary.warnings[0];
      const details = firstIssue ? ` | ملاحظة: ${firstIssue}` : "";
      const messageText = `اكتمل الاستيراد. تمت إضافة ${summary.created} وتحديث ${summary.updated} وتخطي ${summary.skipped} من أصل ${summary.totalRows} صف.${details}`;
      setPageMessage({
        type: summary.skipped > 0 ? "error" : "success",
        text: messageText,
      });
    } catch (importError) {
      const details =
        importError instanceof Error ? ` (${importError.message})` : "";
      setPageMessage({
        type: "error",
        text: `فشل استيراد المنتجات.${details}`,
      });
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;

    setIsSubmitting(true);
    setError("");

    try {
      const numericPrice = toPrice(form.price);
      const numericQuantity = toQuantity(form.quantity);

      if (!form.name.trim()) {
        setError("يرجى إدخال اسم المنتج.");
        return;
      }
      if (!Number.isFinite(numericQuantity) || numericQuantity < 0) {
        setError("يرجى إدخال كمية صحيحة بقيمة 0 أو أكبر.");
        return;
      }
      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        setError("يرجى إدخال سعر صحيح أكبر من صفر.");
        return;
      }

      const payload = {
        name: form.name.trim(),
        size: form.size.trim(),
        stock: numericQuantity,
        brand: form.brand.trim(),
        price: numericPrice,
        barcode: form.barcode.trim(),
        categoryId: form.categoryId,
        image: form.image || defaultImage,
      };

      if (editingId) {
        const updated = await productsService.update(editingId, payload);
        if (!updated) {
          throw new Error("تعذر تحديث المنتج.");
        }
        setPageMessage({
          type: "success",
          text: "تم تحديث المنتج بنجاح.",
        });
      } else {
        const created = await productsService.create(payload);
        if (!created) {
          throw new Error("تعذر إنشاء المنتج.");
        }
        setPageMessage({
          type: "success",
          text: `تمت إضافة المنتج بنجاح. الكود الداخلي: ${created.productCode}`,
        });
      }

      closeModal();
      await loadData();
    } catch (submitError) {
      const details =
        submitError instanceof Error ? ` (${submitError.message})` : "";
      setError(`فشل حفظ المنتج.${details}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="inventory-page">
      <NavSidebar
        items={buildSidebarNavItems("inventory", role)}
        collapsed={false}
        topAction={
          <IconButton variant="accent" aria-label="القائمة الرئيسية">
            <IconGrid />
          </IconButton>
        }
        onItemClick={(id) => {
          if (isAppPage(id)) {
            navigate(`/${id}`);
            return;
          }
        }}
        onLogout={() => {
          logout();
          navigate("/login");
        }}
      />

      <main className="inventory-page__main">
        <section className="inventory-page__content">
          <header className="inventory-toolbar">
            <div className="inventory-toolbar__brand">
              <div>
                <h1 className="inventory-toolbar__title">المخزون</h1>
              </div>
            </div>
            <div className="inventory-toolbar__actions">
              <Input
                type="search"
                icon={<IconSearch />}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="ابحث بالاسم، الحجم، الماركة أو الباركود"
                className="inventory-toolbar__search"
                fullWidth
              />
              <div className="inventory-toolbar__chips">
                <span className="inventory-chip">الأصناف: {totalCount}</span>
                <span className="inventory-chip">
                  القيمة: {totalInventoryValue} LE
                </span>
              </div>
              <Button
                type="button"
                variant="primary"
                icon={<IconPlus />}
                onClick={openAddModal}
                disabled={isImporting || isExporting || !canManage}
              >
                إضافة صنف
              </Button>
            </div>
          </header>

          {pageMessage && (
            <div
              className={`inventory-page__message inventory-page__message--${pageMessage.type}`}
            >
              {pageMessage.text}
            </div>
          )}

          <input
            ref={importFileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="inventory-import__input"
            onChange={handleImportFileChange}
          />

          <section className="inventory-table-card" aria-label="جدول المخزون">
            <div className="inventory-table-card__header">
              <h2>المنتجات</h2>
              <div className="inventory-table-card__header-actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={downloadImportTemplate}
                  disabled={isImporting || isExporting || isSubmitting}
                >
                  تنزيل قالب
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={exportProductsToExcel}
                  loading={isExporting}
                  loadingText="جاري التصدير..."
                  disabled={
                    totalCount === 0 ||
                    isImporting ||
                    isExporting ||
                    isSubmitting
                  }
                >
                  تصدير Excel (XLSX)
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={<IconRefresh />}
                  onClick={openImportDialog}
                  loading={isImporting}
                  loadingText="جاري الاستيراد..."
                  disabled={
                    isImporting || isExporting || isSubmitting || !canManage
                  }
                >
                  استيراد منتجات
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="inventory-table-card__scroll">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>الصورة</th>
                      <th>الاسم</th>
                      <th>الحجم</th>
                      <th>التصنيف</th>
                      <th>الكمية</th>
                      <th>العلامة</th>
                      <th>السعر</th>
                      <th>الكود الداخلي</th>
                      <th>الباركود</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <SkeletonPatterns.TableRow key={index} columns={11} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : items.length === 0 ? (
              <p className="inventory-table-card__empty">
                لا توجد أصناف مطابقة. اضغط "إضافة صنف" لإدخال منتج جديد.
              </p>
            ) : (
              <div className="inventory-table-card__scroll">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>الصورة</th>
                      <th>الاسم</th>
                      <th>الحجم</th>
                      <th>التصنيف</th>
                      <th>الكمية</th>
                      <th>العلامة</th>
                      <th>السعر</th>
                      <th>الكود الداخلي</th>
                      <th>الباركود</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id}>
                        <td>
                          {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                        </td>
                        <td>
                          <img
                            src={item.image || defaultImage}
                            alt={item.name}
                            className="inventory-table__product-image"
                            onError={(e) => {
                              e.currentTarget.src = defaultImage;
                            }}
                          />
                        </td>
                        <td>{item.name}</td>
                        <td>{item.size || "-"}</td>
                        <td>{categoryNameById.get(item.categoryId) || "-"}</td>
                        <td>{item.stock}</td>
                        <td>{item.brand || "-"}</td>
                        <td>{item.price.toFixed(2)} LE</td>
                        <td className="inventory-table__product-code">
                          {item.productCode}
                        </td>
                        <td className="inventory-table__barcode">
                          {item.barcode || "-"}
                        </td>
                        <td>
                          <div className="inventory-table__actions">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => openEditModal(item)}
                              disabled={!canManage}
                            >
                              تعديل
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDuplicate(item)}
                              disabled={!canManage}
                            >
                              نسخ
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(item.id)}
                              disabled={!canManage}
                            >
                              حذف
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!isLoading && items.length > 0 && (
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </section>
        </section>
      </main>

      {isModalOpen && (
        <div
          className="inventory-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? "تعديل صنف" : "إضافة صنف جديد"}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <form className="inventory-modal" onSubmit={handleSubmit} dir="rtl">
            <div className="inventory-modal__header">
              <h3>{editingId ? "تعديل صنف" : "إضافة صنف جديد"}</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeModal}
              >
                إغلاق
              </Button>
            </div>

            {error && <p className="inventory-modal__error">{error}</p>}

            <div className="inventory-modal__fields">
              <label className="inventory-modal__field">
                <span>اسم المنتج *</span>
                <Input
                  value={form.name}
                  onChange={(event) => handleChange("name", event.target.value)}
                  placeholder="مثال: مارلبورو أحمر"
                  fullWidth
                />
              </label>

              <label className="inventory-modal__field">
                <span>الحجم</span>
                <Input
                  value={form.size}
                  onChange={(event) => handleChange("size", event.target.value)}
                  placeholder="عادي / كبير (اختياري)"
                  fullWidth
                />
              </label>

              <label className="inventory-modal__field">
                <span>التصنيف</span>
                <select
                  className="inventory-modal__select"
                  value={form.categoryId}
                  onChange={(event) =>
                    handleChange("categoryId", event.target.value)
                  }
                >
                  <option value="">بدون تصنيف</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inventory-modal__field">
                <span>الكمية *</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step="1"
                  value={form.quantity}
                  onChange={(event) =>
                    handleChange("quantity", event.target.value)
                  }
                  placeholder="1"
                  fullWidth
                />
              </label>

              <label className="inventory-modal__field">
                <span>العلامة التجارية</span>
                <Input
                  value={form.brand}
                  onChange={(event) =>
                    handleChange("brand", event.target.value)
                  }
                  placeholder="اختياري"
                  fullWidth
                />
              </label>

              <label className="inventory-modal__field">
                <span>السعر (LE) *</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(event) =>
                    handleChange("price", event.target.value)
                  }
                  placeholder="0.00"
                  fullWidth
                />
              </label>

              {editingId && (
                <label className="inventory-modal__field">
                  <span>الكود الداخلي (5 أرقام - مختلف عن الباركود)</span>
                  <Input
                    value={editingProductCode || "—"}
                    readOnly
                    className="inventory-modal__code"
                    fullWidth
                  />
                </label>
              )}

              <label className="inventory-modal__field">
                <span>الباركود (اختياري - مختلف عن الكود الداخلي)</span>
                <Input
                  value={form.barcode}
                  onChange={(event) =>
                    handleChange("barcode", event.target.value)
                  }
                  placeholder="اختياري - يختلف عن الكود الداخلي"
                  fullWidth
                />
              </label>

              <label className="inventory-modal__field">
                <span>صورة المنتج (اختياري)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const base64String = reader.result as string;
                        handleChange("image", base64String);
                        setImagePreview(base64String);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="inventory-modal__file-input"
                />
                {imagePreview && (
                  <div className="inventory-modal__image-preview">
                    <img src={imagePreview} alt="معاينة الصورة" />
                  </div>
                )}
              </label>
            </div>

            <div className="inventory-modal__actions">
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                loadingText="جاري الحفظ..."
                disabled={!canManage}
              >
                {editingId ? "حفظ التعديلات" : "إضافة الصنف"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={resetForm}
                disabled={isSubmitting}
              >
                إعادة ضبط
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
