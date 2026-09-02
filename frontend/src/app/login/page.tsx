"use client";

/**
 * Login page — phone + password.
 *
 * Two modes on one screen: "sign in" (phone + password) and "create account"
 * (phone + name + role + password). On success, login() stores the tokens and
 * we redirect to the role dashboard. Redirects immediately if already authed.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { login as loginRequest, register as registerRequest } from "@/lib/api";

type Mode = "signin" | "register";

const DEMO_ACCOUNTS: { role: "farmer" | "buyer" | "admin"; name: string; phone: string; password: string }[] = [
  { role: "farmer", name: "Ravi Patil", phone: "+919000000001", password: "farmer123" },
  { role: "farmer", name: "Sita Deshmukh", phone: "+919000000002", password: "farmer123" },
  { role: "buyer", name: "Anita Traders", phone: "+919000000003", password: "buyer123" },
  { role: "buyer", name: "Mega Foods Pvt", phone: "+919000000004", password: "buyer123" },
  { role: "admin", name: "Platform Admin", phone: "+919000000009", password: "admin123" },
];

function destFor(role: string): string {
  if (role === "farmer") return "/farmer";
  if (role === "admin") return "/admin";
  return "/buyer";
}

export default function LoginPage() {
  const { isAuthenticated, user, login } = useAuth();
  const router = useRouter();
  const t = useTranslations("auth");

  const [mode, setMode] = useState<Mode>("signin");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"farmer" | "buyer">("farmer");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace(destFor(user.role));
    }
  }, [isAuthenticated, user, router]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function signIn(p: string, pw: string) {
    setError(null);
    setLoading(true);
    try {
      const data = await loginRequest(p.trim(), pw);
      login(data.access_token, data.refresh_token, data.user);
      router.replace(destFor(data.user.role));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg.includes("401") ? t("badCredentials") : t("loginError"));
    } finally {
      setLoading(false);
    }
  }

  function useDemo(acc: (typeof DEMO_ACCOUNTS)[number]) {
    setMode("signin");
    setPhone(acc.phone);
    setPassword(acc.password);
    void signIn(acc.phone, acc.password);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signin") {
      await signIn(phone, password);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await registerRequest(phone.trim(), name.trim(), role, password);
      login(data.access_token, data.refresh_token, data.user);
      router.replace(destFor(data.user.role));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("409")) {
        setError(t("phoneTaken"));
        setMode("signin");
      } else {
        setError(t("loginError"));
      }
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]";

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="mb-2 text-2xl font-bold text-[var(--color-brand)]">{t("title")}</h1>

      <div className="mb-6 flex gap-1 rounded-lg bg-[var(--color-border)]/40 p-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => switchMode("signin")}
          className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
            mode === "signin" ? "bg-[var(--color-surface)] text-[var(--color-brand)] shadow-sm" : "opacity-60"
          }`}
        >
          {t("signInTab")}
        </button>
        <button
          type="button"
          onClick={() => switchMode("register")}
          className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
            mode === "register" ? "bg-[var(--color-surface)] text-[var(--color-brand)] shadow-sm" : "opacity-60"
          }`}
        >
          {t("registerTab")}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("phoneLabel")}
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("phonePlaceholder")}
            required
            autoComplete="username"
            className={inputClass}
          />
        </label>

        {mode === "register" && (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("nameLabel")}
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                required
                className={inputClass}
              />
            </label>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">{t("roleLabel")}</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="role" value="farmer" checked={role === "farmer"} onChange={() => setRole("farmer")} />
                {t("roleFarmer")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="role" value="buyer" checked={role === "buyer"} onChange={() => setRole("buyer")} />
                {t("roleBuyer")}
              </label>
            </fieldset>
          </>
        )}

        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("passwordLabel")}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
            required
            minLength={mode === "register" ? 6 : undefined}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            className={inputClass}
          />
          {mode === "register" && (
            <span className="text-xs opacity-60">{t("passwordHint")}</span>
          )}
        </label>

        {error && <p className="text-sm text-[var(--color-wait)]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-[var(--color-brand)] px-4 py-3 font-semibold text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60 transition-colors"
        >
          {loading ? t("loggingIn") : t("continueBtn")}
        </button>
      </form>

      <section className="mt-8 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-brand)]">
          {t("demoTitle")}
        </p>
        <p className="mt-0.5 mb-3 text-xs opacity-60">{t("demoNote")}</p>
        <ul className="flex flex-col gap-1.5">
          {DEMO_ACCOUNTS.map((acc) => (
            <li key={acc.phone}>
              <button
                type="button"
                onClick={() => useDemo(acc)}
                disabled={loading}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-left text-sm transition-colors hover:border-[var(--color-brand)] disabled:opacity-60"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{acc.name}</span>
                  <span className="text-xs opacity-60">
                    {acc.phone} · {acc.password}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-[var(--color-brand)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-brand)]">
                  {acc.role === "farmer" ? t("roleFarmer") : acc.role === "buyer" ? t("roleBuyer") : t("roleAdmin")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
