import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { cloudSync as cloudSyncService } from "../../services/db";
import type { CloudSyncSettings } from "../../services/db";

interface SettingsCloudSyncSectionProps {
  cloudSettings: CloudSyncSettings;
  canManage: boolean;
  onSettingsChange: (field: string, value: unknown) => void;
}

export function SettingsCloudSyncSection({
  cloudSettings,
  canManage,
  onSettingsChange,
}: SettingsCloudSyncSectionProps) {
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  const handleTestConnection = async () => {
    if (!cloudSettings.serverUrl || !cloudSettings.apiKey) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await cloudSyncService.testConnection(
        cloudSettings.serverUrl,
        cloudSettings.apiKey,
      );
      setTestResult(result);
    } catch {
      setTestResult({ success: false, error: "Connection failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await cloudSyncService.syncNow();
      setSyncResult(result);
    } catch {
      setSyncResult({ success: false, error: "Sync failed" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section
      className="settings-page__section"
      role="tabpanel"
      aria-labelledby="settings-tab-cloud"
    >
      <div className="settings-page__section-header">
        <h2 className="settings-page__section-title">المزامنة السحابية</h2>
        <p className="settings-page__section-subtitle">
          ربط النظام بالسحابة لمزامنة البيانات مع لوحة التحكم
        </p>
      </div>

      <div className="settings-page__cards settings-page__cards--print">
        <Card className="settings-page__card">
          <div className="settings-page__card-head">
            <h3 className="settings-page__card-title">إعدادات الخادم السحابي</h3>
            <p className="settings-page__card-subtitle">
              أدخل رابط الخادم ومفتاح API الخاص بالمؤسسة
            </p>
          </div>
          <div className="settings-page__form">
            <div className="settings-page__field">
              <label htmlFor="cloudEnabled">تفعيل المزامنة السحابية</label>
              <div className="settings-page__checkbox">
                <input
                  id="cloudEnabled"
                  type="checkbox"
                  checked={cloudSettings.enabled}
                  onChange={(e) =>
                    onSettingsChange("enabled", e.target.checked)
                  }
                  disabled={!canManage}
                />
                <span>مفعلة</span>
              </div>
            </div>

            <div className="settings-page__field">
              <label htmlFor="cloudServerUrl">رابط الخادم السحابي</label>
              <div className="pos-input-wrapper">
                <input
                  id="cloudServerUrl"
                  type="text"
                  className="pos-input"
                  value={cloudSettings.serverUrl}
                  onChange={(e) =>
                    onSettingsChange("serverUrl", e.target.value)
                  }
                  placeholder="https://your-server.up.railway.app"
                  disabled={!canManage}
                  dir="ltr"
                />
              </div>
            </div>

            <div className="settings-page__field">
              <label htmlFor="cloudApiKey">مفتاح API</label>
              <div className="pos-input-wrapper">
                <input
                  id="cloudApiKey"
                  type="password"
                  className="pos-input"
                  value={cloudSettings.apiKey}
                  onChange={(e) => onSettingsChange("apiKey", e.target.value)}
                  placeholder="أدخل مفتاح API"
                  disabled={!canManage}
                  dir="ltr"
                />
              </div>
            </div>

            <div className="settings-page__printer-actions">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleTestConnection}
                loading={testing}
                disabled={testing || !canManage || !cloudSettings.serverUrl}
              >
                اختبار الاتصال
              </Button>
              {testResult && (
                <span
                  style={{
                    color: testResult.success ? "var(--color-success)" : "var(--color-danger)",
                    fontSize: "0.8rem",
                  }}
                >
                  {testResult.success
                    ? "✓ الاتصال ناجح"
                    : `✗ فشل الاتصال: ${testResult.error}`}
                </span>
              )}
            </div>
          </div>
        </Card>


        <Card className="settings-page__card">
          <div className="settings-page__card-head">
            <h3 className="settings-page__card-title">حالة المزامنة</h3>
            <p className="settings-page__card-subtitle">
              عرض حالة آخر مزامنة وبدء مزامنة يدوية
            </p>
          </div>
          <div className="settings-page__form">
            <div className="settings-page__field">
              <p className="settings-page__hint">
                {cloudSettings.lastSyncAt
                  ? `آخر مزامنة: ${new Date(cloudSettings.lastSyncAt).toLocaleString("ar-EG")}`
                  : "لم يتم إجراء مزامنة بعد"}
                {cloudSettings.lastSyncStatus && (
                  <span
                    style={{
                      color:
                        cloudSettings.lastSyncStatus === "success"
                          ? "var(--color-success)"
                          : "var(--color-danger)",
                      marginRight: 8,
                    }}
                  >
                    {cloudSettings.lastSyncStatus === "success"
                      ? "(ناجحة)"
                      : "(فاشلة)"}
                  </span>
                )}
              </p>
            </div>

            <div className="settings-page__printer-actions">
              <Button
                size="sm"
                variant="primary"
                onClick={handleSyncNow}
                loading={syncing}
                disabled={
                  syncing || !canManage || !cloudSettings.enabled
                }
              >
                مزامنة الآن
              </Button>
              {syncResult && (
                <span
                  style={{
                    color: syncResult.success
                      ? "var(--color-success)"
                      : "var(--color-danger)",
                    fontSize: "0.8rem",
                  }}
                >
                  {syncResult.success
                    ? "✓ تمت المزامنة بنجاح"
                    : `✗ فشلت المزامنة: ${syncResult.error}`}
                </span>
              )}
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
