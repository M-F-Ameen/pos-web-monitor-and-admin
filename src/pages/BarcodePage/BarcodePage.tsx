import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { useNavigate } from "react-router-dom";
import { NavSidebar } from "../../components/layout/NavSidebar";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { Modal } from "../../components/ui/Modal";
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
  IconWallet,
  IconChartBar,
  IconBarcode,
  IconPrinter,
  IconSearch,
  IconRefresh,
  IconSettings,
  IconClock,
} from "../../components/ui/Icons";
import type { NavItem } from "../../components/layout/NavSidebar";
import { canAccessPage, isAppPage, type AppPage } from "../../app/access";
import { useAuth } from "../../app/AuthContext";
import {
  products as productsService,
  type ProductLite,
} from "../../services/db";
import "./BarcodePage.css";

const ITEMS_PER_PAGE = 10;
const GENERATED_BARCODE_IDS_STORAGE_KEY =
  "tobacco_pos_generated_barcode_ids_v1";
const LABEL_WIDTH_MM = 38;
const LABEL_HEIGHT_MM = 25;
const MICRONS_PER_MM = 1000;
const LABEL_PRINTER_CANDIDATES = [
  "Xprinter 428B",
  "Xprinter XP-428B",
  "XP-428B",
];

function loadGeneratedBarcodeIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(GENERATED_BARCODE_IDS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
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

function calculateEan13CheckDigit(base12: string): string {
  const digits = base12.split("").map((digit) => Number(digit));
  const sum = digits.reduce((acc, digit, index) => {
    return acc + digit * (index % 2 === 0 ? 1 : 3);
  }, 0);
  const check = (10 - (sum % 10)) % 10;
  return String(check);
}

function generateEan13(existing: Set<string>): string {
  for (let index = 0; index < 50; index += 1) {
    const seed = `${Date.now()}${Math.floor(Math.random() * 1000000)}`;
    const base12 = seed.slice(-12);
    const candidate = `${base12}${calculateEan13CheckDigit(base12)}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  const fallbackBase = `${Math.floor(Math.random() * 1_000_000_000_000)}`
    .padStart(12, "0")
    .slice(0, 12);
  return `${fallbackBase}${calculateEan13CheckDigit(fallbackBase)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildLabelsPrintDocument(labelArticles: string[]): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Barcode Labels</title>
<style>
  :root {
    --label-width: ${LABEL_WIDTH_MM}mm;
    --label-height: ${LABEL_HEIGHT_MM}mm;
  }
  * { box-sizing: border-box; }
  @page { size: var(--label-width) var(--label-height); margin: 0; }
  html, body {
    width: var(--label-width);
    margin: 0;
    padding: 0;
    background: #fff;
    font-family: Arial, sans-serif;
    color: #111;
  }
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    width: var(--label-width);
  }
  .label {
    width: var(--label-width);
    height: var(--label-height);
    padding: 1.5mm 1.6mm 1.2mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  .label:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .label h2 {
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.1mm;
    font-size: 9px;
    line-height: 1.2;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .label h2 .label-name {
    flex: 1;
    min-width: 0;
    font-size: 8.5px;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .label h2 .label-product-code {
    font-size: 14px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 0.2px;
    direction: ltr;
    text-align: left;
    color: #000;
    flex-shrink: 0;
  }
  .barcode-wrap {
    direction: ltr;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-height: 0;
    margin-top: 0.8mm;
  }
  .barcode-wrap svg {
    width: 100%;
    height: 11.5mm;
  }
  .label p {
    margin: 0.6mm 0 0;
    font-size: 7px;
    letter-spacing: 0.15px;
    text-align: center;
    direction: ltr;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
</head>
<body>
  <section class="sheet">${labelArticles.join("")}</section>
</body>
</html>`;
}

export function BarcodePage() {
  const navigate = useNavigate();
  const { role, logout } = useAuth();
  const canManage = role === "admin";
  const previewRef = useRef<SVGSVGElement | null>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null);

  const [items, setItems] = useState<ProductLite[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [printCount, setPrintCount] = useState("1");
  const [previewError, setPreviewError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingRegenerateItem, setPendingRegenerateItem] =
    useState<ProductLite | null>(null);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [pendingBarcodeUpdates, setPendingBarcodeUpdates] = useState<
    Record<string, string>
  >({});
  const [isLinkingBarcodes, setIsLinkingBarcodes] = useState(false);
  const [generatedBarcodeProductIds, setGeneratedBarcodeProductIds] = useState<
    string[]
  >(() => loadGeneratedBarcodeIds());

  const loadData = useCallback(async () => {
    try {
      const products = await productsService.listLite();
      setItems(products);
    } catch (err) {
      console.error("Failed to load products for barcode page:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedItem = useMemo(
    () => items.find((item) => String(item.id) === selectedId) ?? null,
    [items, selectedId],
  );

  const getEffectiveBarcode = useCallback(
    (item: ProductLite): string =>
      pendingBarcodeUpdates[String(item.id)]?.trim() ??
      item.barcode?.trim() ??
      "",
    [pendingBarcodeUpdates],
  );

  const selectedBarcodeValue = useMemo(
    () => (selectedItem ? getEffectiveBarcode(selectedItem) : ""),
    [selectedItem, getEffectiveBarcode],
  );
  const selectedBulkItems = useMemo(() => {
    const itemsById = new Map(items.map((item) => [String(item.id), item]));
    return bulkSelectedIds
      .map((itemId) => itemsById.get(itemId))
      .filter((item): item is ProductLite => Boolean(item));
  }, [items, bulkSelectedIds]);
  const previewItems = useMemo(() => {
    if (selectedBulkItems.length > 0) {
      return selectedBulkItems;
    }
    return selectedItem ? [selectedItem] : [];
  }, [selectedBulkItems, selectedItem]);
  const previewPrimaryItem = previewItems[0] ?? null;
  const generatedBarcodeProductIdsSet = useMemo(
    () => new Set(generatedBarcodeProductIds),
    [generatedBarcodeProductIds],
  );

  const filteredItems = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    const eligibleItems = items.filter((item) => {
      const itemId = String(item.id);
      const hasBarcode = Boolean(getEffectiveBarcode(item));
      return !hasBarcode || generatedBarcodeProductIdsSet.has(itemId);
    });

    const list = eligibleItems.filter((item) => {
      if (!query) {
        return true;
      }

      return [item.name, getEffectiveBarcode(item)]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    return [...list].sort((first, second) => {
      const firstHasBarcode = Boolean(getEffectiveBarcode(first));
      const secondHasBarcode = Boolean(getEffectiveBarcode(second));

      if (firstHasBarcode === secondHasBarcode) {
        return first.name.localeCompare(second.name, "ar");
      }

      return firstHasBarcode ? 1 : -1;
    });
  }, [items, searchValue, getEffectiveBarcode, generatedBarcodeProductIdsSet]);

  const missingBarcodeCount = useMemo(
    () => items.filter((item) => !getEffectiveBarcode(item)).length,
    [items, getEffectiveBarcode],
  );

  const pendingUpdatesCount = useMemo(
    () => Object.keys(pendingBarcodeUpdates).length,
    [pendingBarcodeUpdates],
  );

  const bulkSelectedIdsSet = useMemo(
    () => new Set(bulkSelectedIds),
    [bulkSelectedIds],
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE)),
    [filteredItems.length],
  );

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);
  const pageSelectableIds = useMemo(
    () => paginatedItems.map((item) => String(item.id)),
    [paginatedItems],
  );
  const allPageSelected = useMemo(
    () =>
      pageSelectableIds.length > 0 &&
      pageSelectableIds.every((itemId) => bulkSelectedIdsSet.has(itemId)),
    [pageSelectableIds, bulkSelectedIdsSet],
  );
  const somePageSelected = useMemo(
    () => pageSelectableIds.some((itemId) => bulkSelectedIdsSet.has(itemId)),
    [pageSelectableIds, bulkSelectedIdsSet],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchValue]);

  useEffect(() => {
    setCurrentPage((previous) => Math.min(previous, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!selectAllCheckboxRef.current) {
      return;
    }
    selectAllCheckboxRef.current.indeterminate =
      somePageSelected && !allPageSelected;
  }, [somePageSelected, allPageSelected]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      GENERATED_BARCODE_IDS_STORAGE_KEY,
      JSON.stringify(generatedBarcodeProductIds),
    );
  }, [generatedBarcodeProductIds]);

  useEffect(() => {
    const itemIds = new Set(items.map((item) => String(item.id)));
    setBulkSelectedIds((previous) =>
      previous.filter((itemId) => itemIds.has(itemId)),
    );
    setPendingBarcodeUpdates((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([itemId]) => itemIds.has(itemId)),
      ),
    );
    setGeneratedBarcodeProductIds((previous) =>
      previous.filter((itemId) => itemIds.has(itemId)),
    );
  }, [items]);

  useEffect(() => {
    if (!selectedItem || !previewRef.current) {
      setPreviewError("");
      return;
    }

    const barcodeValue = selectedBarcodeValue;
    if (!barcodeValue) {
      previewRef.current.innerHTML = "";
      setPreviewError("");
      return;
    }

    try {
      const format = /^\d{13}$/.test(barcodeValue) ? "EAN13" : "CODE128";
      JsBarcode(previewRef.current, barcodeValue, {
        format,
        displayValue: true,
        height: 72,
        width: 2,
        margin: 8,
        fontSize: 16,
        textMargin: 2,
        background: "#ffffff",
        lineColor: "#111111",
      });
      setPreviewError("");
    } catch {
      setPreviewError("تعذر عرض هذا الباركود. جرب توليد كود جديد.");
    }
  }, [selectedItem, selectedBarcodeValue]);

  useEffect(() => {
    if (!selectedId && filteredItems.length > 0) {
      setSelectedId(String(filteredItems[0].id));
    }
  }, [filteredItems, selectedId]);

  function generateBarcodeForItem(item: ProductLite) {
    const itemId = String(item.id);
    const existing = new Set(
      items
        .map((inventoryItem) => getEffectiveBarcode(inventoryItem))
        .filter(Boolean),
    );

    const newBarcode = generateEan13(existing);
    setPendingBarcodeUpdates((previous) => ({
      ...previous,
      [itemId]: newBarcode,
    }));
    setGeneratedBarcodeProductIds((previous) =>
      previous.includes(itemId) ? previous : [...previous, itemId],
    );
    setSelectedId(itemId);
  }

  function handleGenerateForItem(item: ProductLite) {
    if (!canManage) {
      return;
    }
    const hasBarcode = Boolean(getEffectiveBarcode(item));
    if (hasBarcode) {
      setPendingRegenerateItem(item);
      return;
    }
    generateBarcodeForItem(item);
  }

  function handleGenerateForSelected() {
    if (!canManage) {
      return;
    }
    if (!selectedItem) {
      return;
    }
    handleGenerateForItem(selectedItem);
  }

  function handleConfirmRegenerate() {
    if (!canManage) {
      return;
    }
    if (!pendingRegenerateItem) {
      return;
    }
    generateBarcodeForItem(pendingRegenerateItem);
    setPendingRegenerateItem(null);
  }

  function handleSelectAllMissingBarcodes() {
    if (!canManage) {
      return;
    }
    const missingIds = items
      .filter((item) => !getEffectiveBarcode(item))
      .map((item) => String(item.id));
    setBulkSelectedIds(missingIds);
    ensureBarcodesForItems(
      missingIds
        .map((itemId) =>
          items.find((item) => String(item.id) === String(itemId)),
        )
        .filter((item): item is ProductLite => Boolean(item)),
    );
  }

  function toggleProductSelection(itemId: string, checked: boolean) {
    setBulkSelectedIds((previous) => {
      if (checked) {
        return previous.includes(itemId) ? previous : [...previous, itemId];
      }
      return previous.filter((id) => id !== itemId);
    });
    if (checked && canManage) {
      const item = items.find((product) => String(product.id) === itemId);
      if (item) {
        ensureBarcodesForItems([item]);
      }
    }
  }

  function handleSelectAllVisibleProducts(checked: boolean) {
    setBulkSelectedIds((previous) => {
      const nextSet = new Set(previous);
      if (checked) {
        for (const itemId of pageSelectableIds) {
          nextSet.add(itemId);
        }
        if (canManage) {
          const pageItems = pageSelectableIds
            .map((itemId) =>
              items.find((product) => String(product.id) === itemId),
            )
            .filter((item): item is ProductLite => Boolean(item));
          ensureBarcodesForItems(pageItems);
        }
      } else {
        for (const itemId of pageSelectableIds) {
          nextSet.delete(itemId);
        }
      }
      return [...nextSet];
    });
  }

  function ensureBarcodesForItems(
    targetItems: ProductLite[],
  ): Map<string, string> {
    const existingBarcodes = new Set(
      items.map((item) => getEffectiveBarcode(item)).filter(Boolean),
    );
    const resolved = new Map<string, string>();
    const generatedUpdates: Record<string, string> = {};
    const generatedIds: string[] = [];

    for (const item of targetItems) {
      const itemId = String(item.id);
      const currentBarcode = getEffectiveBarcode(item);
      if (currentBarcode) {
        resolved.set(itemId, currentBarcode);
        continue;
      }

      if (!canManage) {
        continue;
      }

      const newBarcode = generateEan13(existingBarcodes);
      existingBarcodes.add(newBarcode);
      resolved.set(itemId, newBarcode);
      generatedUpdates[itemId] = newBarcode;
      generatedIds.push(itemId);
    }

    if (generatedIds.length > 0) {
      setPendingBarcodeUpdates((previous) => ({
        ...previous,
        ...generatedUpdates,
      }));
      setGeneratedBarcodeProductIds((previous) => {
        const merged = new Set(previous);
        for (const itemId of generatedIds) {
          merged.add(itemId);
        }
        return [...merged];
      });
    }

    return resolved;
  }

  function buildLabelArticle(
    name: string,
    productCode: string,
    barcodeValue: string,
  ): string | null {
    try {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const format = /^\d{13}$/.test(barcodeValue) ? "EAN13" : "CODE128";
      JsBarcode(svg, barcodeValue, {
        format,
        displayValue: false,
        height: 38,
        width: 1.25,
        margin: 0,
        background: "#ffffff",
        lineColor: "#111111",
      });

      const safeName = escapeHtml(name);
      const safeProductCode = escapeHtml(productCode || "-----");
      const safeBarcode = escapeHtml(barcodeValue);
      return `<article class="label"><h2><span class="label-name">${safeName}</span><span class="label-product-code">${safeProductCode}</span></h2><div class="barcode-wrap">${svg.outerHTML}</div><p>${safeBarcode}</p></article>`;
    } catch {
      return null;
    }
  }

  async function openPrintWindowForLabels(labelArticles: string[]) {
    if (labelArticles.length === 0) {
      return;
    }

    const printDocument = buildLabelsPrintDocument(labelArticles);
    if (window.electronAPI?.printHtml) {
      try {
        const printed = await window.electronAPI.printHtml(printDocument, {
          printerName: LABEL_PRINTER_CANDIDATES[0],
          printerNameCandidates: LABEL_PRINTER_CANDIDATES,
          pageSizeMicrons: {
            width: LABEL_WIDTH_MM * MICRONS_PER_MM,
            height: LABEL_HEIGHT_MM * MICRONS_PER_MM,
          },
          silent: true,
        });
        if (printed) {
          return;
        }
      } catch (err) {
        console.error("Failed to print labels using Electron:", err);
      }
    }

    const printWindow = window.open("", "_blank", "width=960,height=700");

    if (!printWindow) {
      return;
    }

    printWindow.document.open();
    printWindow.document.write(printDocument);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }

  async function handleGenerateAndPrintBulk() {
    if (!canManage) {
      return;
    }
    if (bulkSelectedIds.length === 0) {
      return;
    }

    const itemsById = new Map(items.map((item) => [String(item.id), item]));
    const selectedItems = bulkSelectedIds
      .map((itemId) => itemsById.get(itemId))
      .filter((item): item is ProductLite => Boolean(item));

    if (selectedItems.length === 0) {
      return;
    }

    const updates = ensureBarcodesForItems(selectedItems);

    const copies = Math.max(1, Math.min(100, Number(printCount) || 1));
    const labelArticles: string[] = [];
    for (const item of selectedItems) {
      const barcode = updates.get(String(item.id));
      if (!barcode) {
        continue;
      }
      const article = buildLabelArticle(item.name, item.productCode, barcode);
      if (!article) {
        continue;
      }
      for (let copyIndex = 0; copyIndex < copies; copyIndex += 1) {
        labelArticles.push(article);
      }
    }

    await openPrintWindowForLabels(labelArticles);
    setBulkSelectedIds([]);
  }

  async function handleLinkBarcodesToProducts() {
    if (!canManage) {
      return;
    }
    const updates = Object.entries(pendingBarcodeUpdates);
    if (updates.length === 0 || isLinkingBarcodes) {
      return;
    }

    setIsLinkingBarcodes(true);
    try {
      await Promise.all(
        updates.map(([itemId, barcode]) =>
          productsService.update(itemId, { barcode }),
        ),
      );

      setItems((previous) =>
        previous.map((item) => {
          const nextBarcode = pendingBarcodeUpdates[String(item.id)];
          return nextBarcode ? { ...item, barcode: nextBarcode } : item;
        }),
      );
      setPendingBarcodeUpdates({});
    } catch (err) {
      console.error("Failed to link barcodes to products:", err);
    } finally {
      setIsLinkingBarcodes(false);
    }
  }

  async function handlePrintLabel() {
    if (previewItems.length === 0) {
      return;
    }

    const copies = Math.max(1, Math.min(100, Number(printCount) || 1));
    const resolvedBarcodes = ensureBarcodesForItems(previewItems);
    const labelArticles: string[] = [];

    for (const item of previewItems) {
      const barcodeValue = resolvedBarcodes.get(String(item.id));
      if (!barcodeValue) {
        continue;
      }
      const article = buildLabelArticle(
        item.name,
        item.productCode,
        barcodeValue,
      );
      if (!article) {
        continue;
      }
      for (let copyIndex = 0; copyIndex < copies; copyIndex += 1) {
        labelArticles.push(article);
      }
    }

    await openPrintWindowForLabels(labelArticles);
  }

  return (
    <div className="barcode-page">
      <NavSidebar
        items={buildNavItems("barcode", role)}
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

      <main className="barcode-page__main">
        <section className="barcode-page__content">
          <header className="barcode-toolbar">
            <div className="barcode-toolbar__brand">
              <h1 className="barcode-toolbar__title">توليد وطباعة الباركود</h1>
              <p>أصناف بدون باركود: {missingBarcodeCount}</p>
              <p>باركودات غير مربوطة: {pendingUpdatesCount}</p>
            </div>

            <div className="barcode-toolbar__actions">
              <Input
                type="search"
                icon={<IconSearch />}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="ابحث باسم الصنف أو الماركة أو الباركود"
                className="barcode-toolbar__search"
                fullWidth
              />
              <Button
                type="button"
                variant="secondary"
                icon={<IconRefresh />}
                onClick={handleGenerateForSelected}
                disabled={!selectedItem || !canManage}
              >
                توليد للمحدد
              </Button>
              <Button
                type="button"
                variant="secondary"
                icon={<IconBarcode />}
                onClick={handleSelectAllMissingBarcodes}
                disabled={missingBarcodeCount === 0 || !canManage}
              >
                تحديد بدون باركود
              </Button>
              <Button
                type="button"
                variant="primary"
                icon={<IconPrinter />}
                onClick={handleGenerateAndPrintBulk}
                disabled={bulkSelectedIds.length === 0 || !canManage}
              >
                توليد وطباعة الكل ({bulkSelectedIds.length})
              </Button>
              <Button
                type="button"
                variant="secondary"
                icon={<IconBarcode />}
                onClick={handleLinkBarcodesToProducts}
                loading={isLinkingBarcodes}
                disabled={
                  pendingUpdatesCount === 0 || isLinkingBarcodes || !canManage
                }
              >
                ربط الباركودات ({pendingUpdatesCount})
              </Button>
            </div>
          </header>

          <section
            className="barcode-layout"
            aria-label="إدارة باركود المنتجات"
          >
            <article className="barcode-products-card">
              <header className="barcode-products-card__header">
                <h2>المنتجات</h2>
                <span>إجمالي: {filteredItems.length}</span>
              </header>

              {filteredItems.length === 0 ? (
                <p className="barcode-products-card__empty">
                  لا توجد أصناف في المخزون حالياً.
                </p>
              ) : (
                <>
                  <div className="barcode-products-card__scroll">
                    <table className="barcode-products-table">
                      <thead>
                        <tr>
                          <th className="barcode-products-table__checkbox-col">
                            <input
                              ref={selectAllCheckboxRef}
                              type="checkbox"
                              className="barcode-products-table__checkbox"
                              checked={allPageSelected}
                              onChange={(event) =>
                                handleSelectAllVisibleProducts(
                                  event.target.checked,
                                )
                              }
                              aria-label="تحديد كل المنتجات المعروضة"
                              disabled={!canManage}
                            />
                          </th>
                          <th>الصنف</th>
                          <th>الحالة</th>
                          <th>الباركود</th>
                          <th>الإجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map((item) => {
                          const effectiveBarcode = getEffectiveBarcode(item);
                          const hasBarcode = Boolean(effectiveBarcode);
                          const isSelected = selectedId === String(item.id);
                          const isBulkSelected = bulkSelectedIdsSet.has(
                            String(item.id),
                          );
                          const rowClassName = [
                            isSelected ? "is-selected" : "",
                            isBulkSelected ? "is-bulk-selected" : "",
                          ]
                            .filter(Boolean)
                            .join(" ");

                          return (
                            <tr
                              key={item.id}
                              className={rowClassName || undefined}
                              onClick={() => setSelectedId(String(item.id))}
                            >
                              <td
                                className="barcode-products-table__checkbox-col"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  className="barcode-products-table__checkbox"
                                  checked={isBulkSelected}
                                  onChange={(event) =>
                                    toggleProductSelection(
                                      String(item.id),
                                      event.target.checked,
                                    )
                                  }
                                  aria-label={`تحديد ${item.name}`}
                                  disabled={!canManage}
                                />
                              </td>
                              <td>
                                <strong>{item.name}</strong>
                              </td>
                              <td>
                                <span
                                  className={
                                    hasBarcode
                                      ? "barcode-state barcode-state--ready"
                                      : "barcode-state barcode-state--missing"
                                  }
                                >
                                  {hasBarcode ? "جاهز" : "بدون باركود"}
                                </span>
                              </td>
                              <td className="barcode-products-table__code">
                                {hasBarcode ? effectiveBarcode : "-"}
                              </td>
                              <td>
                                <Button
                                  type="button"
                                  variant={hasBarcode ? "secondary" : "primary"}
                                  size="sm"
                                  icon={<IconBarcode />}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleGenerateForItem(item);
                                  }}
                                  disabled={!canManage}
                                >
                                  {hasBarcode ? "إعادة توليد" : "توليد باركود"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <TablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </>
              )}
            </article>

            <article className="barcode-preview-card">
              <header className="barcode-preview-card__header">
                <h2>معاينة الملصق</h2>
              </header>

              {previewItems.length === 0 ? (
                <p className="barcode-preview-card__empty">
                  اختر صنفاً لعرض الباركود.
                </p>
              ) : (
                <>
                  <div className="barcode-preview-meta">
                    <h3>
                      {selectedBulkItems.length > 0
                        ? `المحدد للطباعة (${selectedBulkItems.length})`
                        : (previewPrimaryItem?.name ?? "")}
                    </h3>
                    <p>
                      {selectedBulkItems.length > 0 ? (
                        <>جاهز لمعاينة وطباعة كل الملصقات المحددة.</>
                      ) : (
                        <>
                          الكمية بالمخزون:{" "}
                          <strong>{previewPrimaryItem?.stock ?? 0}</strong>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="barcode-preview-canvas" dir="ltr">
                    {previewItems.length > 0 ? (
                      <div className="barcode-preview-list" dir="rtl">
                        {previewItems.map((item) => {
                          const effectiveBarcode = getEffectiveBarcode(item);
                          return (
                            <article
                              key={item.id}
                              className="barcode-preview-list__item"
                            >
                              <h4>
                                <span>{item.name}</span>
                                <strong className="barcode-preview-list__product-code">
                                  {item.productCode || "-----"}
                                </strong>
                              </h4>
                              {effectiveBarcode ? (
                                <div
                                  className="barcode-preview-list__svg"
                                  dir="ltr"
                                >
                                  <svg
                                    ref={(element) => {
                                      if (selectedItem?.id === item.id) {
                                        previewRef.current = element;
                                      }
                                      if (element && effectiveBarcode) {
                                        try {
                                          const format = /^\d{13}$/.test(
                                            effectiveBarcode,
                                          )
                                            ? "EAN13"
                                            : "CODE128";
                                          JsBarcode(element, effectiveBarcode, {
                                            format,
                                            displayValue: true,
                                            height: 58,
                                            width: 1.7,
                                            margin: 6,
                                            fontSize: 13,
                                            textMargin: 2,
                                            background: "#ffffff",
                                            lineColor: "#111111",
                                          });
                                        } catch {
                                          // Keep fallback text below if rendering fails.
                                        }
                                      }
                                    }}
                                    role="img"
                                    aria-label={`Barcode for ${item.name}`}
                                  />
                                </div>
                              ) : (
                                <p className="barcode-preview-list__empty-code">
                                  بدون باركود
                                </p>
                              )}
                              <p className="barcode-preview-list__code">
                                {effectiveBarcode || "-"}
                              </p>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <p>هذا الصنف بدون باركود. اضغط "توليد للمحدد".</p>
                    )}
                  </div>

                  {previewError && (
                    <p className="barcode-preview-card__error">
                      {previewError}
                    </p>
                  )}

                  <div className="barcode-preview-actions">
                    <label className="barcode-preview-actions__count">
                      <span>عدد الملصقات</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={100}
                        step={1}
                        value={printCount}
                        onChange={(event) => setPrintCount(event.target.value)}
                      />
                    </label>

                    <Button
                      type="button"
                      variant="primary"
                      icon={<IconPrinter />}
                      onClick={handlePrintLabel}
                      disabled={previewItems.length === 0}
                    >
                      {selectedBulkItems.length > 0
                        ? "طباعة المحدد"
                        : "طباعة الملصق"}
                    </Button>
                  </div>
                </>
              )}
            </article>
          </section>
        </section>
      </main>

      <Modal
        isOpen={pendingRegenerateItem !== null}
        onClose={() => setPendingRegenerateItem(null)}
        size="sm"
        title="تأكيد إعادة التوليد"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPendingRegenerateItem(null)}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirmRegenerate}
              disabled={!canManage}
            >
              نعم، غيّر الباركود
            </Button>
          </>
        }
      >
        <p className="barcode-regenerate-warning">
          هذا المنتج لديه باركود بالفعل. إعادة التوليد ستغيّر الباركود الأصلي.
        </p>
        <p className="barcode-regenerate-warning__item">
          {pendingRegenerateItem?.name}
        </p>
      </Modal>
    </div>
  );
}
