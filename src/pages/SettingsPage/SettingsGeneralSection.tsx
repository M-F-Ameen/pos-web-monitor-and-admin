import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import type { POSSettings, ThemeMode } from "../../services/db";

type InputChangeFactory = (
  field: keyof POSSettings,
) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

type CheckboxChangeFactory = (
  field: keyof POSSettings,
) => (event: React.ChangeEvent<HTMLInputElement>) => void;

type SelectChangeFactory = (
  field: keyof POSSettings,
) => (event: React.ChangeEvent<HTMLSelectElement>) => void;

interface SettingsGeneralSectionProps {
  canManage: boolean;
  defaultProductImage: string;
  handleCheckboxChange: CheckboxChangeFactory;
  handleDefaultImageFileChange: (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void;
  handleInputChange: InputChangeFactory;
  handleResetDefaultImage: () => Promise<void>;
  handleSelectChange: SelectChangeFactory;
  handleThemeModeChange: (themeMode: ThemeMode) => Promise<void>;
  savingThemeMode: ThemeMode | null;
  settings: POSSettings;
}

export function SettingsGeneralSection({
  canManage,
  defaultProductImage,
  handleCheckboxChange,
  handleDefaultImageFileChange,
  handleInputChange,
  handleResetDefaultImage,
  handleSelectChange,
  handleThemeModeChange,
  savingThemeMode,
  settings,
}: SettingsGeneralSectionProps) {
  return (
    <section
      className="settings-page__section"
      role="tabpanel"
      aria-labelledby="settings-tab-general"
    >
      <div className="settings-page__section-header">
        <h2 className="settings-page__section-title">الإعدادات العامة</h2>
        <p className="settings-page__section-subtitle">
          إعدادات المتجر والفاتورة وسلوك نظام نقطة البيع
        </p>
      </div>

      <div className="settings-page__cards settings-page__cards--general">
        <Card className="settings-page__card settings-page__card--span-2">
          <div className="settings-page__card-head">
            <h3 className="settings-page__card-title">معلومات المتجر</h3>
            <p className="settings-page__card-subtitle">
              البيانات التي تظهر في الفاتورة والتقارير
            </p>
          </div>
          <div className="settings-page__form">
            <div className="settings-page__field">
              <label htmlFor="storeName">اسم المتجر</label>
              <Input
                id="storeName"
                type="text"
                value={settings.storeName}
                onChange={handleInputChange("storeName")}
                placeholder="متجر التبغ"
                fullWidth
              />
            </div>

            <div className="settings-page__row settings-page__row--2">
              <div className="settings-page__field">
                <label htmlFor="storeAddress">عنوان المتجر</label>
                <Input
                  id="storeAddress"
                  type="text"
                  value={settings.storeAddress}
                  onChange={handleInputChange("storeAddress")}
                  placeholder="شارع الملك فهد، الرياض"
                  fullWidth
                />
              </div>

              <div className="settings-page__field">
                <label htmlFor="storePhone">رقم الهاتف</label>
                <Input
                  id="storePhone"
                  type="tel"
                  value={settings.storePhone}
                  onChange={handleInputChange("storePhone")}
                  placeholder="+966 50 123 4567"
                  fullWidth
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="settings-page__card">
          <div className="settings-page__card-head">
            <h3 className="settings-page__card-title">إعدادات الفاتورة</h3>
            <p className="settings-page__card-subtitle">
              العملة ونصوص الطباعة الافتراضية
            </p>
          </div>
          <div className="settings-page__form">
            <div className="settings-page__field">
              <label htmlFor="receiptFooter">رسالة الترحيب (أسفل الفاتورة)</label>
              <textarea
                id="receiptFooter"
                value={settings.receiptFooter}
                onChange={handleInputChange("receiptFooter")}
                placeholder="نشكركم على تسوقكم معنا"
                className="settings-page__textarea"
                rows={3}
              />
            </div>

            <div className="settings-page__row settings-page__row--2">
              <div className="settings-page__field">
                <label htmlFor="currency">العملة</label>
                <Input
                  id="currency"
                  type="text"
                  value={settings.currency}
                  onChange={handleInputChange("currency")}
                  placeholder="LE"
                  fullWidth
                />
              </div>

              <div className="settings-page__field">
                <label htmlFor="currencySymbol">رمز العملة</label>
                <Input
                  id="currencySymbol"
                  type="text"
                  value={settings.currencySymbol}
                  onChange={handleInputChange("currencySymbol")}
                  placeholder="ج.م"
                  fullWidth
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="settings-page__card">
          <div className="settings-page__card-head">
            <h3 className="settings-page__card-title">إعدادات النظام</h3>
            <p className="settings-page__card-subtitle">
              خيارات افتراضية لتسريع عملية البيع
            </p>
          </div>
          <div className="settings-page__form">
            <div className="settings-page__field">
              <label htmlFor="defaultPaymentMethod">طريقة الدفع الافتراضية</label>
              <select
                id="defaultPaymentMethod"
                value={settings.defaultPaymentMethod}
                onChange={handleSelectChange("defaultPaymentMethod")}
                className="settings-page__select"
              >
                <option value="cash">نقدي</option>
                <option value="card">بطاقة</option>
                <option value="wallet">محفظة</option>
              </select>
            </div>

            <div className="settings-page__checkbox-group">
              <label className="settings-page__checkbox">
                <input
                  type="checkbox"
                  checked={settings.allowNegativeStock}
                  onChange={handleCheckboxChange("allowNegativeStock")}
                />
                السماح بالمخزون السالب
              </label>

              <label className="settings-page__checkbox">
                <input
                  type="checkbox"
                  checked={settings.requireCustomer}
                  onChange={handleCheckboxChange("requireCustomer")}
                />
                إجبار اختيار العميل
              </label>

              <label className="settings-page__checkbox">
                <input
                  type="checkbox"
                  checked={settings.printReceiptAutomatically}
                  onChange={handleCheckboxChange("printReceiptAutomatically")}
                />
                طباعة الفاتورة تلقائيًا
              </label>
            </div>
          </div>
        </Card>

        <Card className="settings-page__card">
          <div className="settings-page__card-head">
            <h3 className="settings-page__card-title">مظهر التطبيق</h3>
            <p className="settings-page__card-subtitle">
              اختر المظهر المناسب للعمل. يتم تطبيق التغيير مباشرة على الواجهة.
            </p>
          </div>
          <div className="settings-page__form">
            <div className="settings-page__theme-options">
              {(["dark", "light"] as const).map((themeMode) => (
                <button
                  key={themeMode}
                  type="button"
                  className={`settings-page__theme-option ${
                    settings.themeMode === themeMode
                      ? "settings-page__theme-option--active"
                      : ""
                  }`}
                  onClick={() => {
                    void handleThemeModeChange(themeMode);
                  }}
                  disabled={!canManage || savingThemeMode !== null}
                  aria-pressed={settings.themeMode === themeMode}
                >
                  <span
                    className={`settings-page__theme-preview settings-page__theme-preview--${themeMode}`}
                  >
                    <span className="settings-page__theme-preview-top" />
                    <span className="settings-page__theme-preview-body" />
                  </span>
                  <span className="settings-page__theme-copy">
                    <strong>{themeMode === "dark" ? "داكن" : "فاتح"}</strong>
                    <span>
                      {themeMode === "dark"
                        ? "طبقات أعمق وتباين هادئ مناسب لفترات العمل الطويلة."
                        : "سطوح ناعمة وألوان دافئة بمظهر أنيق وواضح أثناء النهار."}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card className="settings-page__card">
          <div className="settings-page__card-head">
            <h3 className="settings-page__card-title">صورة المنتج الافتراضية</h3>
            <p className="settings-page__card-subtitle">
              الصورة التي تظهر للمنتجات التي لا تحتوي على صورة خاصة
            </p>
          </div>
          <div className="settings-page__form">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1.5rem",
                padding: "1rem 0",
              }}
            >
              <img
                src={defaultProductImage}
                alt="الصورة الافتراضية"
                style={{
                  width: 80,
                  height: 80,
                  objectFit: "cover",
                  borderRadius: 8,
                  border: "2px solid var(--color-border)",
                }}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {canManage && (
                  <>
                    <label
                      htmlFor="defaultImageUpload"
                      style={{
                        cursor: "pointer",
                        display: "inline-block",
                        padding: "0.45rem 1rem",
                        borderRadius: 6,
                        background: "var(--color-primary, #ff7a00)",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                      }}
                    >
                      تغيير الصورة
                    </label>
                    <input
                      id="defaultImageUpload"
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handleDefaultImageFileChange}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleResetDefaultImage()}
                    >
                      إعادة تعيين
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
