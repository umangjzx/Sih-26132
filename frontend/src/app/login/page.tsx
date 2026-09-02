"use client";

/**
 * Login page — single-step, passwordless / OTP-less (demo build).
 *
 * Enter phone + name + role → login() issues a token → redirect to dashboard.
 * If already authenticated on mount, redirects immediately.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { login as loginRequest } from "@/lib/api";

export default function LoginPage() {
  const { isAuthenticated, user, login } = useAuth();
  const router = useRouter();
  const t = useTranslations("auth");

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"farmer" | "buyer">("farmer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace(user.role === "farmer" ? "/farmer" : "/buyer");
    }
  }, [isAuthenticated, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await loginRequest(phone.trim(), name.trim(), role);
      login(data.access_token, data.refresh_token, data.user);
      router.replace(data.user.role === "farmer" ? "/farmer" : "/buyer");
    } catch {
      setError(t("loginError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="mb-8 text-2xl font-bold text-[var(--color-brand)]">
        {t("title")}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("phoneLabel")}
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("phonePlaceholder")}
            required
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("nameLabel")}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            required
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t("roleLabel")}</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="role"
              value="farmer"
              checked={role === "farmer"}
              onChange={() => setRole("farmer")}
            />
            {t("roleFarmer")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="role"
              value="buyer"
              checked={role === "buyer"}
              onChange={() => setRole("buyer")}
            />
            {t("roleBuyer")}
          </label>
        </fieldset>

        {error && <p className="text-sm text-[var(--color-wait)]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-[var(--color-brand)] px-4 py-3 font-semibold text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60 transition-colors"
        >
          {loading ? t("loggingIn") : t("signIn")}
        </button>
      </form>
    </div>
  );
}
