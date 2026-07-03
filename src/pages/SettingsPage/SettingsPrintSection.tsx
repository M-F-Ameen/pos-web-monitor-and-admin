import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { IconPrinter, IconRefresh } from "../../components/ui/Icons";
import type { InstalledPrinter, POSSettings } from "../../services/db";

type SelectChangeFactory = (
  field: keyof POSSettings,
) => (event: React.ChangeEvent<HTMLSelectElement>) => void;

interface SettingsPrintSectionProps {
  defaultPrinterName: string | null;
  handlePrintTestReceipt: () => Promise<void>;
  handleSelectChange: SelectChangeFactory;
  installedPrinters: InstalledPrinter[];
  loadingPrinters: boolean;
  onReloadPrinters: () => Promise<void>;
  printingTestReceipt: boolean;
  recommendedPrinterName: string | null;
  settings: POSSettings;
  xp80cAvailable: boolean;
}

export function SettingsPrintSection({
  defaultPrinterName,
  handlePrintTestReceipt,
  handleSelectChange,
  installedPrinters,
  loadingPrinters,
  onReloadPrinters,
  printingTestReceipt,
  recommendedPrinterName,
  settings,
  xp80cAvailable,
}: SettingsPrintSectionProps) {
  return (
    <section
      className="settings-page__section"
      role="tabpanel"
      aria-labelledby="settings-tab-print"
    >
      <div className="settings-page__section-header">
        <h2 className="settings-page__section-title">إعدادات الطباعة</h2>
        <p className="settings-page__section-subtitle">
          إدارة طابعة الإيصالات وتجربة الطباعة
        </p>
      </div>

      <div className="settings-page__cards settings-page__cards--print">
        <Card className="settings-page__card">
          <div className="settings-page__card-head">
            <h3 className="settings-page__card-title">إعدادات طابعة الإيصال</h3>
            <p className="settings-page__card-subtitle">
              اختر الطابعة أو اترك الوضع التلقائي
            </p>
          </div>
          <div className="settings-page__form">
            <div className="settings-page__field">
              <label htmlFor="receiptPrinterName">الطابعة المستخدمة</label>
              <select
                id="receiptPrinterName"
                value={settings.receiptPrinterName}
                onChange={handleSelectChange("receiptPrinterName")}
                className="settings-page__select"
                disabled={loadingPrinters || printingTestReceipt}
              >
                <option value="">تلقائي (XP-80C ثم الطابعة الافتراضية)</option>
                {installedPrinters.map((printer) => (
                  <option key={printer.name} value={printer.name}>
                    {printer.name}
                    {printer.isDefault ? " (Default)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <p className="settings-page__hint">
              {loadingPrinters
                ? "جارٍ فحص الطابعات المثبتة..."
                : installedPrinters.length === 0
                  ? "لم يتم العثور على أي طابعة."
                  : xp80cAvailable
                    ? "تم اكتشاف XP-80C. ستُستخدم تلقائيًا عند اختيار الوضع التلقائي."
                    : recommendedPrinterName
                      ? `لم يتم العثور على XP-80C. سيتم استخدام ${recommendedPrinterName} تلقائيًا.`
                      : "لا توجد طابعة افتراضية متاحة حاليًا."}
            </p>

            {defaultPrinterName && (
              <p className="settings-page__hint">
                الطابعة الافتراضية للنظام: {defaultPrinterName}
              </p>
            )}

            <div className="settings-page__printer-actions">
              <Button
                size="sm"
                variant="secondary"
                icon={<IconRefresh />}
                onClick={() => {
                  void onReloadPrinters();
                }}
                disabled={loadingPrinters || printingTestReceipt}
              >
                تحديث الطابعات
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={<IconPrinter />}
                onClick={() => {
                  void handlePrintTestReceipt();
                }}
                loading={printingTestReceipt}
                loadingText="جارٍ الطباعة..."
                disabled={loadingPrinters || printingTestReceipt}
              >
                طباعة إيصال اختبار
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
