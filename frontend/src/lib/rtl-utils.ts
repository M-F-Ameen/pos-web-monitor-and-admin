/**
 * RTL Utilities
 * Helper functions for RTL layout support
 */

/**
 * Get CSS direction value
 */
export function getDir(): 'rtl' | 'ltr' {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_RTL === 'true' ? 'rtl' : 'ltr';
  }
  return document.documentElement.dir as 'rtl' | 'ltr';
}

/**
 * Check if current direction is RTL
 */
export function isRTL(): boolean {
  return getDir() === 'rtl';
}

/**
 * Get left/right property based on direction
 * @example getLR('left', 'right') => 'right' if RTL, 'left' if LTR
 */
export function getLR(left: string, right: string): string {
  return isRTL() ? right : left;
}

/**
 * Get margin values with direction
 * @example getMargin(8) => { marginInlineStart: 8 } (RTL-aware)
 */
export function getMargin(value: number | string, position?: 'start' | 'end' | 'both') {
  const sides = position || 'both';
  if (sides === 'both') {
    return { marginInline: value };
  }
  return { [`marginInline${position === 'start' ? 'Start' : 'End'}`]: value };
}

/**
 * Get padding values with direction
 */
export function getPadding(value: number | string, position?: 'start' | 'end' | 'both') {
  const sides = position || 'both';
  if (sides === 'both') {
    return { paddingInline: value };
  }
  return { [`paddingInline${position === 'start' ? 'Start' : 'End'}`]: value };
}

/**
 * Format number with RTL support
 */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  const locale = process.env.NEXT_PUBLIC_LOCALE || 'ar';
  const formatter = new Intl.NumberFormat(locale, {
    ...options,
  });
  return formatter.format(value);
}

/**
 * Format currency with RTL support
 */
export function formatCurrency(value: number, currency: string = 'EGP'): string {
  const locale = process.env.NEXT_PUBLIC_LOCALE || 'ar';
  const formatter = new Intl.NumberFormat(locale, {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatter.format(value)} جنيه`;
}

/**
 * Format date with RTL support
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const locale = process.env.NEXT_PUBLIC_LOCALE || 'ar';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  });
  return formatter.format(dateObj);
}

/**
 * Format time with RTL support
 */
export function formatTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const locale = process.env.NEXT_PUBLIC_LOCALE || 'ar';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    ...options,
  });
  return formatter.format(dateObj);
}

/**
 * Format date and time together
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${formatDate(d)} ${formatTime(d)}`;
}

/**
 * Get phone number with direction awareness
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

/**
 * Translate text to Arabic or English
 * Placeholder for i18n integration
 */
export const labels = {
  // Common
  dashboard: 'لوحة التحكم',
  sales: 'المبيعات',
  returns: 'المرتجعات',
  treasury: 'الخزينة',
  shifts: 'الورديات',
  reports: 'التقارير',
  customers: 'العملاء',
  login: 'تسجيل الدخول',

  // Actions
  refresh: 'تحديث',
  filter: 'تصفية',
  search: 'بحث',
  export: 'تصدير',
  print: 'طباعة',
  delete: 'حذف',
  edit: 'تعديل',
  save: 'حفظ',
  cancel: 'إلغاء',

  // Status
  completed: 'مكتمل',
  pending: 'قيد الانتظار',
  cancelled: 'ملغي',
  processing: 'جاري المعالجة',

  // Common fields
  date: 'التاريخ',
  time: 'الوقت',
  total: 'الإجمالي',
  amount: 'المبلغ',
  status: 'الحالة',
  user: 'المستخدم',
  name: 'الاسم',
  phone: 'الهاتف',
  email: 'البريد الإلكتروني',
  notes: 'ملاحظات',

  // Placeholders
  noData: 'لا توجد بيانات',
  loading: 'جاري التحميل...',
  error: 'حدث خطأ',
  tryAgain: 'حاول مرة أخرى',
};

/**
 * Get Arabic label for status
 */
export function getStatusLabel(status: string): string {
  const statusLabels: Record<string, string> = {
    completed: 'مكتمل',
    pending: 'قيد الانتظار',
    cancelled: 'ملغي',
    processing: 'جاري المعالجة',
    open: 'مفتوح',
    closed: 'مغلق',
    in_progress: 'جاري',
  };
  return statusLabels[status] || status;
}

/**
 * Get color for status
 */
export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    completed: 'bg-success-100 text-success-700',
    pending: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-negative-100 text-negative-700',
    processing: 'bg-blue-100 text-blue-700',
    open: 'bg-accent-100 text-accent-700',
    closed: 'bg-neutral-100 text-neutral-600',
    in_progress: 'bg-blue-100 text-blue-700',
  };
  return statusColors[status] || 'bg-neutral-100 text-neutral-600';
}

/**
 * Calculate percentage change between two numbers.
 * Returns a signed percentage (positive for increase, negative for decrease).
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}
