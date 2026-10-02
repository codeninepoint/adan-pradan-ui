"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RedirectIfAuthenticated } from "@/components/auth-guards";
import { useAuth } from "@/components/auth-provider";
import { ApiError, authApi } from "@/lib/api";
import { saveSession } from "@/lib/session";

function LoginForm() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const verified = searchParams.get("verified") === "1";
  const resetOk = searchParams.get("reset") === "1";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const token = await authApi.login({
        email: email.trim(),
        password,
      });
      saveSession(token);
      await refreshProfile();
      router.push("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Sign in failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 bg-background text-foreground">
      <main className="mx-auto max-w-md px-4 py-10 sm:px-6">
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          ← Back to home
        </Link>

        <div className="mt-6">
          <h1 className="text-2xl font-extrabold text-foreground">Sign in to your workspace</h1>
          <p className="mt-1 text-sm text-muted">Use the email and password from your account.</p>
        </div>

        {verified && (
          <p className="mt-4 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
            Email verified. You can sign in now.
          </p>
        )}
        {resetOk && (
          <p className="mt-4 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
            Password updated. Sign in with your new password.
          </p>
        )}

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

          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wide text-muted">
                Password <span className="text-error">*</span>
              </label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              autoComplete="current-password"
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
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Create account
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <RedirectIfAuthenticated>
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center bg-background text-sm text-muted">
            Loading…
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </RedirectIfAuthenticated>
  );
}
