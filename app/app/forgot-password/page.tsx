"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { RedirectIfAuthenticated } from "@/components/auth-guards";
import { ApiError, authApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setDevToken(null);
    setSubmitting(true);
    try {
      const result = await authApi.passwordResetRequest({ email: email.trim() });
      setMessage(result.message);
      if (result.dev_reset_token) {
        setDevToken(result.dev_reset_token);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Request failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RedirectIfAuthenticated>
      <div className="flex-1 bg-background text-foreground">
        <main className="mx-auto max-w-md px-4 py-10 sm:px-6">
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            ← Back to sign in
          </Link>

          <div className="mt-6">
            <h1 className="text-2xl font-extrabold text-foreground">Reset your password</h1>
            <p className="mt-1 text-sm text-muted">
              Enter your email and we&apos;ll send a reset link (in local dev the token is shown here).
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-6 rounded-xl border border-border bg-surface p-5">
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                Email <span className="text-error">*</span>
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                autoComplete="email"
              />
            </div>

            {error && (
              <p className="mb-4 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
                {error}
              </p>
            )}
            {message && (
              <p className="mb-4 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
                {message}
              </p>
            )}
            {devToken && (
              <div className="mb-4 rounded-lg border border-border bg-[var(--hero-tint)] px-3 py-2 text-xs text-muted">
                <span className="mb-2 inline-block rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  Dev only
                </span>
                <p className="mb-2">Reset token (not emailed in local):</p>
                <code className="block break-all font-mono text-foreground">{devToken}</code>
                <button
                  type="button"
                  className="mt-3 text-sm font-semibold text-primary hover:underline"
                  onClick={() =>
                    router.push(`/reset-password?token=${encodeURIComponent(devToken)}`)
                  }
                >
                  Continue to set new password →
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Send reset link"}
            </button>
          </form>
        </main>
      </div>
    </RedirectIfAuthenticated>
  );
}
