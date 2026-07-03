import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { IconAlertTriangle, IconRefresh } from "../../components/ui/Icons";
import type { AutoBackupStatus, DataScope } from "../../services/db";
import { DATA_SCOPE_CONFIG } from "./settingsPage.config";

interface SettingsBackupSectionProps {
  activeBackupScope: DataScope | null;
  autoBackupStatus: AutoBackupStatus | null;
  canManage: boolean;
  hasDataTaskInProgress: boolean;
  loading: boolean;
  onCreateBackup: (scope: DataScope) => Promise<void>;
  onOpenResetModal: (scope: DataScope) => void;
  onOpenRestoreModal: (scope: DataScope) => void;
}

export function SettingsBackupSection({
  activeBackupScope,
  autoBackupStatus,
  canManage,
  hasDataTaskInProgress,
  loading,
  onCreateBackup,
  onOpenResetModal,
  onOpenRestoreModal,
}: SettingsBackupSectionProps) {
  return (
    <section
      className="settings-page__section"
      role="tabpanel"
      aria-labelledby="settings-tab-backup"
    >
      <div className="settings-page__section-header">
        <h2 className="settings-page__section-title">
          النسخ الاحتياطي وحماية البيانات
        </h2>
        <p className="settings-page__section-subtitle">
          إدارة النسخ والاستعادة وإعادة التعيين بحسب نطاق البيانات
        </p>
      </div>

      <Card className="settings-page__card">
        <div className="settings-page__card-head">
          <h3 className="settings-page__card-title">
            النسخ الاحتياطي التلقائي اليومي
          </h3>
          <p className="settings-page__card-subtitle">
            يعمل تلقائيًا كل 24 ساعة بدون تدخل يدوي ويحفظ كامل بيانات النظام
          </p>
        </div>
        <div className="settings-page__form">
          <div className="settings-page__auto-backup-row">
            <span className="settings-page__auto-backup-badge">✔ مفعّل</span>
            <span className="settings-page__hint">كل 24 ساعة</span>
          </div>
          {autoBackupStatus && (
            <>
              <p className="settings-page__hint">
                <strong>مجلد النسخ:</strong>{" "}
                <span dir="ltr" style={{ wordBreak: "break-all" }}>
                  {autoBackupStatus.backupDirectory}
                </span>
              </p>
              <p className="settings-page__hint">
                <strong>آخر نسخة احتياطية:</strong>{" "}
                {autoBackupStatus.lastBackupAt
                  ? new Date(autoBackupStatus.lastBackupAt).toLocaleString("ar-EG")
                  : "لم تُنفذ بعد (تُنفذ خلال 5 دقائق من بدء التشغيل)"}
              </p>
              <p className="settings-page__hint">
                <strong>النسخة القادمة:</strong>{" "}
                {autoBackupStatus.nextBackupAt
                  ? new Date(autoBackupStatus.nextBackupAt).toLocaleString("ar-EG")
                  : "غير مجدولة"}
              </p>
            </>
          )}
        </div>
      </Card>

      <div className="settings-page__cards settings-page__cards--scoped-backup">
        {(Object.keys(DATA_SCOPE_CONFIG) as DataScope[]).map((scope) => {
          const config = DATA_SCOPE_CONFIG[scope];
          return (
            <Card
              key={scope}
              className={`settings-page__card ${
                scope === "system" ? "settings-page__card--danger" : ""
              }`}
            >
              <div className="settings-page__card-head">
                <h3 className="settings-page__card-title">{config.cardTitle}</h3>
                <p className="settings-page__card-subtitle">
                  {config.cardSubtitle}
                </p>
              </div>

              <div className="settings-page__form">
                <p className="settings-page__hint">{config.backupHint}</p>
                <div className="settings-page__backup-actions">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<IconRefresh />}
                    onClick={() => {
                      void onCreateBackup(scope);
                    }}
                    loading={activeBackupScope === scope}
                    loadingText="جارٍ إنشاء النسخة..."
                    disabled={hasDataTaskInProgress || loading || !canManage}
                  >
                    إنشاء نسخة
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<IconAlertTriangle />}
                    onClick={() => onOpenRestoreModal(scope)}
                    disabled={hasDataTaskInProgress || loading || !canManage}
                  >
                    استعادة نسخة
                  </Button>
                </div>

                <p className="settings-page__danger-text">{config.resetHint}</p>
                <Button
                  size="sm"
                  variant="danger"
                  icon={<IconRefresh />}
                  onClick={() => onOpenResetModal(scope)}
                  disabled={hasDataTaskInProgress || loading || !canManage}
                >
                  {config.resetButtonLabel}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
