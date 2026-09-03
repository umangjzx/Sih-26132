"use client";

/**
 * Login / Register page — premium split-screen design.
 *
 * Left panel: branded hero with value props (hidden on mobile).
 * Right panel: sign-in / register form + demo accounts.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { useAuth } from "@/components/AuthProvider";
import { useLocation } from "@/lib/useLocation";
import { login as loginRequest, register as registerRequest } from "@/lib/api";
import { Icon } from "@/components/ui";

type Mode = "signin" | "register";

type DemoAccount = {
  role: "farmer" | "buyer" | "admin";
  name: string;
  phone: string;
  password: string;
  region: string;
};

// Mirrors backend/scripts/seed_demo_users.py — keep in sync when the seed changes.
const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: "farmer", name: "Ravi Patil", phone: "+919000000001", password: "farmer123", region: "Maharashtra" },
  { role: "farmer", name: "Sita Deshmukh", phone: "+919000000002", password: "farmer123", region: "Maharashtra" },
  { role: "buyer", name: "Anita Traders", phone: "+919000000003", password: "buyer123", region: "Maharashtra" },
  { role: "buyer", name: "Mega Foods Pvt", phone: "+919000000004", password: "buyer123", region: "Maharashtra" },
  { role: "admin", name: "Platform Admin", phone: "+919000000009", password: "admin123", region: "Maharashtra" },
  { role: "farmer", name: "Murugan Selvam", phone: "+919000000011", password: "farmer123", region: "Tamil Nadu" },
  { role: "farmer", name: "Lakshmi Farms (FPO)", phone: "+919000000012", password: "farmer123", region: "Tamil Nadu" },
  { role: "buyer", name: "Kovai Traders", phone: "+919000000013", password: "buyer123", region: "Tamil Nadu" },
  { role: "buyer", name: "TN Agro Buyers", phone: "+919000000014", password: "buyer123", region: "Tamil Nadu" },
  { role: "buyer", name: "Chennai Exports Co", phone: "+919000000015", password: "buyer123", region: "Tamil Nadu" },
  { role: "buyer", name: "Salem Fresh Mart", phone: "+919000000016", password: "buyer123", region: "Tamil Nadu" },
];

const DEMO_REGIONS: string[] = [...new Set(DEMO_ACCOUNTS.map((a) => a.region))];

function destFor(role: string): string {
  if (role === "farmer") return "/farmer";
  if (role === "admin") return "/admin";
  return "/buyer";
}

const ROLE_COLORS: Record<string, string> = {
  farmer: "bg-[var(--green-100)] text-[var(--green-700)]",
  buyer:  "bg-blue-50 text-blue-600",
  admin:  "bg-[var(--amber-100)] text-[var(--amber-700)]",
};

export default function LoginPage() {
  const { isAuthenticated, user, login } = useAuth();
  const { location } = useLocation();
  const router = useRouter();
  const t = useTranslations("auth");

  const [mode, setMode] = useState<Mode>("signin");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"farmer" | "buyer">("farmer");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);

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
      const data = await registerRequest(phone.trim(), name.trim(), role, password, {
        district: location?.district || null,
        state: location?.state || null,
        latitude: location?.lat ?? null,
        longitude: location?.lon ?? null,
      });
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

  return (
    <div className="-mx-4 -mt-6 flex min-h-[calc(100vh-80px)] sm:-mx-6 lg:-mx-8">
      {/* ── LEFT PANEL: Branding (hidden on mobile) ── */}
      <div
        className="relative hidden w-[45%] overflow-hidden lg:flex lg:flex-col lg:justify-between"
        style={{
          background: "linear-gradient(155deg, #071a0f 0%, #0e3421 40%, #1a4a2e 70%, #2E7D32 100%)",
        }}
      >
        {/* Background image */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "url('/bg-image.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.06,
          }}
        />
        <div className="al-grid-overlay pointer-events-none absolute inset-0" />
        {/* Ambient orbs */}
        <div
          className="pointer-events-none absolute -right-20 top-1/4 h-80 w-80 rounded-full blur-[100px]"
          style={{ background: "rgba(244, 164, 0, 0.08)" }}
        />
        <div
          className="pointer-events-none absolute -left-20 bottom-1/4 h-64 w-64 rounded-full blur-[80px]"
          style={{ background: "rgba(129, 199, 132, 0.1)" }}
        />

        <div className="relative z-10 flex flex-1 flex-col justify-center px-12 py-16 xl:px-16">
          <Link href="/" className="mb-12 inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--amber-500)] shadow-lg shadow-amber-900/30">
              <Icon name="leaf" size={22} className="text-white" />
            </div>
            <span className="font-heading text-2xl font-extrabold text-white">AgriLink</span>
          </Link>

          <h2 className="font-heading text-3xl font-extrabold leading-snug text-white xl:text-4xl">
            Real prices.{" "}
            <span className="bg-gradient-to-r from-[var(--amber-400)] to-[var(--amber-500)] bg-clip-text text-transparent">
              Fair deals.
            </span>
          </h2>

          <p className="mt-5 max-w-md text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
            Government mandi data becomes a clear sell-now-or-wait call, the best
            market after transport, and verified buyers — all tracked from offer
            to payment.
          </p>

          <div className="mt-10 flex flex-col gap-4">
            {[
              { icon: "chart", text: "Live mandi prices from AGMARKNET" },
              { icon: "spark", text: "Explainable AI sell/wait signals" },
              { icon: "handshake", text: "Verified buyer-seller marketplace" },
              { icon: "shield", text: "End-to-end deal tracking" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  <Icon name={item.icon} size={16} className="text-[var(--amber-400)]" />
                </div>
                <span className="text-sm font-medium text-white/80">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom trust bar */}
        <div
          className="relative z-10 border-t px-12 py-5 xl:px-16"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>
            Smart India Hackathon 2026 · PS-26132 · Govt. of Maharashtra / MSInS
          </p>
          <p className="mt-1 text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>
            100% free · English, Hindi, Marathi · Works offline
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL: Form ── */}
      <div className="flex flex-1 flex-col overflow-y-auto bg-[var(--paper)]">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10 sm:px-8">
          {/* Mobile logo */}
          <Link href="/" className="mb-8 inline-flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--green-700)] shadow-md">
              <Icon name="leaf" size={18} className="text-white" />
            </div>
            <span className="font-heading text-xl font-extrabold text-[var(--green-700)]">AgriLink</span>
          </Link>

          <h1 className="font-heading text-2xl font-extrabold text-[var(--ink)] sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--ink-soft)]">
            {mode === "signin"
              ? "Sign in to access your dashboard"
              : "Create a free account in seconds"}
          </p>

          {/* Mode tabs */}
          <div className="mt-6 flex rounded-xl border border-[var(--line)] bg-[var(--paper)] p-1">
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all duration-200 ${
                mode === "signin"
                  ? "bg-[var(--green-700)] text-white shadow-md shadow-green-900/15"
                  : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              {t("signInTab")}
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all duration-200 ${
                mode === "register"
                  ? "bg-[var(--green-700)] text-white shadow-md shadow-green-900/15"
                  : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              {t("registerTab")}
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
            <label className="flex flex-col gap-1.5">
              <span className="al-label">{t("phoneLabel")}</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("phonePlaceholder")}
                required
                autoComplete="username"
                className="al-input"
              />
            </label>

            {mode === "register" && (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="al-label">{t("nameLabel")}</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                    required
                    className="al-input"
                  />
                </label>

                <fieldset className="flex flex-col gap-2.5">
                  <legend className="al-label">{t("roleLabel")}</legend>
                  <div className="grid grid-cols-2 gap-3">
                    {(["farmer", "buyer"] as const).map((r) => (
                      <label
                        key={r}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--green-400)] ${
                          role === r
                            ? "border-[var(--green-600)] bg-[var(--green-50)] text-[var(--green-700)]"
                            : "border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--green-400)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={r}
                          checked={role === r}
                          onChange={() => setRole(r)}
                          className="sr-only"
                        />
                        <Icon name={r === "farmer" ? "leaf" : "users"} size={18} />
                        {r === "farmer" ? t("roleFarmer") : t("roleBuyer")}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="al-label">{t("passwordLabel")}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("passwordPlaceholder")}
                required
                minLength={mode === "register" ? 6 : undefined}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                className="al-input"
              />
              {mode === "register" && (
                <span className="text-xs text-[var(--ink-mute)]">{t("passwordHint")}</span>
              )}
            </label>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--red-300)]/40 bg-[var(--red-50)] px-4 py-3 text-sm font-medium text-[var(--red-500)]">
                <Icon name="alert" size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="al-btn-primary w-full py-3.5 text-base disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round" />
                  </svg>
                  {t("loggingIn")}
                </span>
              ) : (
                t("continueBtn")
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--line)]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-mute)]">
              or try a demo
            </span>
            <div className="h-px flex-1 bg-[var(--line)]" />
          </div>

          {/* Demo Accounts */}
          <div className="mt-6">
            <button
              type="button"
              aria-expanded={demoOpen}
              aria-controls="demo-accounts-panel"
              onClick={() => setDemoOpen(!demoOpen)}
              className="flex w-full items-center justify-between rounded-xl border border-dashed border-[var(--green-600)]/30 bg-[var(--green-50)]/50 px-4 py-3 text-left transition-colors hover:bg-[var(--green-50)]"
            >
              <div className="flex items-center gap-2.5">
                <Icon name="spark" size={16} className="text-[var(--green-600)]" />
                <div>
                  <p className="text-sm font-bold text-[var(--green-700)]">{t("demoTitle")}</p>
                  <p className="text-xs text-[var(--ink-soft)]">{t("demoNote")}</p>
                </div>
              </div>
              <Icon
                name="arrowDown"
                size={14}
                className={`text-[var(--green-600)] transition-transform duration-200 ${demoOpen ? "rotate-180" : ""}`}
              />
            </button>

            {demoOpen && (
              <div id="demo-accounts-panel" className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                {DEMO_REGIONS.map((region) => (
                  <div key={region} className="mb-3 last:mb-0">
                    <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-[var(--ink-mute)]">
                      {region}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {DEMO_ACCOUNTS.filter((a) => a.region === region).map((acc) => (
                        <button
                          key={acc.phone}
                          type="button"
                          onClick={() => useDemo(acc)}
                          disabled={loading}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-left transition-all duration-200 hover:border-[var(--green-600)]/40 hover:shadow-sm disabled:opacity-50"
                        >
                          <div className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-[var(--ink)]">
                              {acc.name}
                            </span>
                            <span className="block text-xs text-[var(--ink-soft)]">
                              {acc.phone} · {acc.password}
                            </span>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              ROLE_COLORS[acc.role] || ""
                            }`}
                          >
                            {acc.role === "farmer"
                              ? t("roleFarmer")
                              : acc.role === "buyer"
                                ? t("roleBuyer")
                                : t("roleAdmin")}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
