import { Button } from "../../components/ui/Button";
import { IconAlertTriangle } from "../../components/ui/Icons";
import { Modal } from "../../components/ui/Modal";
import type { DataScope } from "../../services/db";
import { DATA_SCOPE_CONFIG } from "./settingsPage.config";

interface SettingsDialogsProps {
  canManage: boolean;
  onCloseResetModal: () => void;
  onCloseRestoreModal: () => void;
  onConfirmReset: () => Promise<void>;
  onConfirmRestore: () => Promise<void>;
  pendingResetScope: DataScope | null;
  pendingRestoreScope: DataScope | null;
  resettingData: boolean;
  restoringBackup: boolean;
}

export function SettingsDialogs({
  canManage,
  onCloseResetModal,
  onCloseRestoreModal,
  onConfirmReset,
  onConfirmRestore,
  pendingResetScope,
  pendingRestoreScope,
  resettingData,
  restoringBackup,
}: SettingsDialogsProps) {
  const pendingResetConfig = pendingResetScope
    ? DATA_SCOPE_CONFIG[pendingResetScope]
    : null;
  const pendingRestoreConfig = pendingRestoreScope
    ? DATA_SCOPE_CONFIG[pendingRestoreScope]
    : null;

  return (
    <>
      <Modal
        isOpen={pendingResetScope !== null}
        onClose={onCloseResetModal}
        title={`تحذير: ${
          pendingResetConfig?.resetButtonLabel ?? "إعادة التعيين"
        }`}
        size="md"
        closeOnBackdrop={!resettingData}
        closeOnEscape={!resettingData}
        footer={
          <div className="settings-page__reset-modal-actions">
            <Button
              variant="secondary"
              onClick={onCloseResetModal}
              disabled={resettingData || !canManage}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                void onConfirmReset();
              }}
              loading={resettingData}
              loadingText="جارٍ إنشاء نسخة احتياطية ثم إعادة التعيين..."
              icon={<IconAlertTriangle />}
              disabled={resettingData || !canManage}
            >
              تأكيد إعادة التعيين
            </Button>
          </div>
        }
      >
        <div className="settings-page__reset-modal-body">
          <div className="settings-page__reset-modal-alert">
            <IconAlertTriangle />
            <span>
              {pendingResetConfig?.resetDescription ??
                "سيتم حذف البيانات المحددة."}
            </span>
          </div>
          <p className="settings-page__reset-modal-text">
            {pendingResetConfig?.resetHint ??
              "هذا الإجراء يؤثر على البيانات الحالية حسب النطاق المحدد."}
          </p>
          <p className="settings-page__reset-modal-text">
            سيتم أولًا إنشاء نسخة احتياطية تلقائية إلزامية للنظام بالكامل قبل
            تنفيذ إعادة التعيين.
          </p>
          <p className="settings-page__reset-modal-text settings-page__reset-modal-text--strong">
            هذا الإجراء نهائي ولا يمكن التراجع عنه.
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={pendingRestoreScope !== null}
        onClose={onCloseRestoreModal}
        title={`تحذير: استعادة نسخة ${pendingRestoreConfig?.cardTitle ?? ""}`}
        size="md"
        closeOnBackdrop={!restoringBackup}
        closeOnEscape={!restoringBackup}
        footer={
          <div className="settings-page__reset-modal-actions">
            <Button
              variant="secondary"
              onClick={onCloseRestoreModal}
              disabled={restoringBackup || !canManage}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                void onConfirmRestore();
              }}
              loading={restoringBackup}
              loadingText="جارٍ الاستعادة..."
              icon={<IconAlertTriangle />}
              disabled={restoringBackup || !canManage}
            >
              اختيار ملف النسخة والاستعادة
            </Button>
          </div>
        }
      >
        <div className="settings-page__reset-modal-body">
          <div className="settings-page__reset-modal-alert">
            <IconAlertTriangle />
            <span>
              {pendingRestoreConfig?.restoreAlert ??
                "سيتم استبدال البيانات المحددة."}
            </span>
          </div>
          <p className="settings-page__reset-modal-text">
            {pendingRestoreConfig?.restoreDescription ??
              "بعد التأكيد ستختار ملف النسخة الاحتياطية المطلوب استعادته."}
          </p>
          <p className="settings-page__reset-modal-text settings-page__reset-modal-text--strong">
            سيتم إنشاء نسخة أمان تلقائية قبل الاستعادة لتقليل مخاطر فقدان
            البيانات.
          </p>
        </div>
      </Modal>
    </>
  );
}
