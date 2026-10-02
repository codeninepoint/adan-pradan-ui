"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RedirectIfAuthenticated } from "@/components/auth-guards";
import { ApiError, authApi } from "@/lib/api";

function passwordOk(password: string): boolean {
  return (
    password.length >= 10 &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") ?? "";
  const [resetToken, setResetToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const strong = useMemo(() => passwordOk(password), [password]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!strong) {
      setError(
        "Password needs at least 10 characters, one uppercase letter, one digit, and one special character.",
      );
      return;
    }
    setSubmitting(true);
    try {
      await authApi.passwordReset({
        reset_token: resetToken.trim(),
        new_password: password,
      });
      router.push("/login?reset=1");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else if (err instanceof TypeError) {
        setError("Cannot reach the API. Is the backend running?");
      } else {
        setError("Reset failed. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 bg-background text-foreground">
      <main className="mx-auto max-w-md px-4 py-10 sm:px-6">
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          ← Back to sign in
        </Link>

        <div className="mt-6">
          <h1 className="text-2xl font-extrabold text-foreground">Choose a new password</h1>
          <p className="mt-1 text-sm text-muted">Paste your reset token and set a new password.</p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 rounded-xl border border-border bg-surface p-5">
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
              Reset token <span className="text-error">*</span>
            </label>
            <textarea
              required
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 font-mono text-xs text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
              New password <span className="text-error">*</span>
            </label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              autoComplete="new-password"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
              Confirm password <span className="text-error">*</span>
            </label>
            <input
              required
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="mb-4 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            {submitting ? "Updating…" : "Update password"}
          </button>
        </form>
      </main>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <RedirectIfAuthenticated>
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center bg-background text-sm text-muted">
            Loading…
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </RedirectIfAuthenticated>
  );
}
