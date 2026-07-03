import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../app/AuthContext";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { users as usersService } from "../../services/db";
import "./LoginPage.css";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userList, setUserList] = useState<
    { fullName: string; email: string }[]
  >([]);

  useEffect(() => {
    usersService
      .list()
      .then((list) => {
        setUserList(
          list
            .filter((u) => u.isActive)
            .map((u) => ({ fullName: u.fullName, email: u.email })),
        );
      })
      .catch(() => {});
  }, []);

  const from = (location.state as any)?.from?.pathname || "/pos";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("يرجى إدخال البريد الإلكتروني.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("يرجى إدخال بريد إلكتروني صحيح.");
      return;
    }

    if (!password) {
      setError("يرجى إدخال كلمة المرور.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const result = await login(normalizedEmail, password);
      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(result.error ?? "بيانات الدخول غير صحيحة.");
      }
    } catch {
      setError("حدث خطأ أثناء تسجيل الدخول.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div
        className="login-page__bg-shape login-page__bg-shape--top"
        aria-hidden
      />
      <div
        className="login-page__bg-shape login-page__bg-shape--bottom"
        aria-hidden
      />

      <main className="login-card" role="main" aria-label="تسجيل الدخول">
        <header className="login-card__header">
          <span className="login-card__badge">Freedom POS</span>
          <h1 className="login-card__title">تسجيل الدخول</h1>
          <p className="login-card__subtitle">
            أدخل البريد الإلكتروني وكلمة المرور للمتابعة.
          </p>
        </header>

        <form className="login-form" onSubmit={handleSubmit} dir="rtl">
          {userList.length > 0 && (
            <label className="login-form__field">
              <span>اختر مستخدمًا</span>
              <select
                className="login-form__user-select"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }
                }}
              >
                <option value="" disabled>
                  — اختر من القائمة —
                </option>
                {userList.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="login-form__field">
            <span>البريد الإلكتروني</span>
            <Input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              placeholder="example@store.com"
              fullWidth
              autoComplete="email"
            />
          </label>

          <label className="login-form__field">
            <span>كلمة المرور</span>
            <Input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              placeholder="********"
              fullWidth
              autoComplete="current-password"
            />
          </label>

          {error && <p className="login-form__error">{error}</p>}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={loading}
          >
            {loading ? "جاري الدخول..." : "دخول"}
          </Button>
        </form>
      </main>
    </div>
  );
}
