import type { DataScope, POSSettings } from "../../services/db";

export type SettingsTab = "general" | "backup" | "print";

export const DEFAULT_SETTINGS_FORM: POSSettings = {
  storeName: "متجر التبغ",
  storeAddress: "",
  storePhone: "",
  taxRate: 0,
  currency: "LE",
  currencySymbol: "ج.م",
  themeMode: "dark",
  receiptFooter: "",
  defaultPaymentMethod: "cash",
  allowNegativeStock: false,
  requireCustomer: false,
  printReceiptAutomatically: false,
  receiptPrinterName: "",
  defaultProductImage: "",
};

export const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "general", label: "الإعدادات العامة" },
  { id: "backup", label: "النسخ الاحتياطي" },
  { id: "print", label: "الطباعة" },
];

export const DATA_SCOPE_CONFIG: Record<
  DataScope,
  {
    cardTitle: string;
    cardSubtitle: string;
    backupHint: string;
    resetHint: string;
    resetButtonLabel: string;
    restoreAlert: string;
    restoreDescription: string;
    resetDescription: string;
  }
> = {
  system: {
    cardTitle: "1) النظام بالكامل",
    cardSubtitle: "نسخة/استعادة/تصفير لكل البيانات",
    backupHint:
      "يحفظ كل بيانات النظام: المستخدمين والإعدادات والمخزون والعمليات المالية والبيعية.",
    resetHint:
      "إعادة تعيين كاملة ستحذف جميع بيانات النظام ثم تعيد تهيئة المستخدمين والإعدادات الافتراضية.",
    resetButtonLabel: "إعادة تعيين النظام بالكامل",
    restoreAlert: "سيتم استبدال قاعدة البيانات الحالية بالكامل.",
    restoreDescription:
      "بعد تأكيد العملية ستختار ملف النسخة الاحتياطية الكاملة، وسيتم استبدال كل بيانات النظام الحالية.",
    resetDescription:
      "سيتم حذف جميع بيانات النظام (المستخدمين، الإعدادات، المخزون، العمليات)، ثم إعادة تهيئة بيانات البداية الافتراضية.",
  },
  inventory: {
    cardTitle: "2) المخزون",
    cardSubtitle: "فئات/منتجات/موردين",
    backupHint:
      "يحفظ بيانات المخزون فقط: الفئات، المنتجات، الموردين، وحركات الموردين.",
    resetHint:
      "إعادة تعيين المخزون ستحذف بيانات الفئات والمنتجات والموردين وحركات الموردين.",
    resetButtonLabel: "إعادة تعيين المخزون",
    restoreAlert: "سيتم استبدال بيانات المخزون فقط.",
    restoreDescription:
      "سيتم تحميل ملف نسخة المخزون، ثم استبدال بيانات المخزون الحالية دون المساس بباقي بيانات النظام.",
    resetDescription:
      "سيتم حذف بيانات المخزون فقط (الفئات والمنتجات والموردين وحركات الموردين).",
  },
  operations: {
    cardTitle: "3) العمليات",
    cardSubtitle: "مبيعات/مرتجعات/خزينة/شفتات",
    backupHint:
      "يحفظ بيانات العمليات فقط: المبيعات، المرتجعات، الخزينة، الشفتات، وملخصات مالية العملاء.",
    resetHint:
      "إعادة تعيين العمليات ستحذف سجل العمليات وتصفّر المؤشرات المالية المرتبطة بها.",
    resetButtonLabel: "إعادة تعيين العمليات",
    restoreAlert: "سيتم استبدال بيانات العمليات فقط.",
    restoreDescription:
      "سيتم تحميل ملف نسخة العمليات، ثم استبدال بيانات العمليات الحالية مع تطبيق القيم المالية المحفوظة للعملاء.",
    resetDescription:
      "سيتم حذف المبيعات والمرتجعات والخزينة والشفتات، مع تصفير الملخصات المالية للعملاء.",
  },
};

export const RESET_METRIC_LABELS: Record<string, string> = {
  saleItems: "عناصر المبيعات",
  sales: "المبيعات",
  returns: "المرتجعات",
  treasuryOperations: "حركات الخزينة",
  userShifts: "الشفتات",
  customersFinancials: "العملاء المصفرون",
  products: "المنتجات",
  categories: "الفئات",
  suppliers: "الموردون",
  supplierOperations: "حركات الموردين",
  customers: "العملاء",
  users: "المستخدمون",
  settings: "الإعدادات",
};

export const RESET_MANDATORY_BACKUP_SCOPE: DataScope = "system";
