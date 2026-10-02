"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RedirectIfAuthenticated } from "@/components/auth-guards";
import { ApiError, authApi } from "@/lib/api";
import { savePendingSignup } from "@/lib/session";

const WIZARD_STEPS = [
  { label: "Your details", active: true },
  { label: "Verify email", active: false },
  { label: "Ready", active: false },
] as const;

function passwordStrength(password: string): { label: string; width: string; ok: boolean } {
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const longEnough = password.length >= 10;
  const score = [hasUpper, hasDigit, hasSpecial, longEnough].filter(Boolean).length;
  if (score <= 1) return { label: "Weak", width: "w-1/4", ok: false };
  if (score === 2) return { label: "Fair", width: "w-2/4", ok: false };
  if (score === 3) return { label: "Good", width: "w-3/4", ok: false };
  return { label: "Strong password", width: "w-4/5", ok: true };
}

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!strength.ok) {
      setError(
        "Password needs at least 10 characters, one uppercase letter, one digit, and one special character.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await authApi.register({
        email: email.trim(),
        password,
        display_name: displayName.trim(),
        agreed_to_terms: true,
      });
      savePendingSignup({
        email: email.trim(),
        tenant_id: result.tenant_id,
        org_id: result.org_id,
        user_id: result.user_id,
        dev_otp: result.dev_otp ?? undefined,
      });
      router.push("/signup/verify");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else if (err instanceof TypeError) {
        setError(
          "Cannot reach the API. Is the backend running on http://127.0.0.1:8000 with CORS enabled?",
        );
      } else {
        setError("Registration failed. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RedirectIfAuthenticated>
    <div className="flex-1 bg-background text-foreground">
      <main className="mx-auto max-w-md px-4 py-10 sm:px-6">
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          ← Back to home
        </Link>

        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Step 1 of 3</p>
          <h1 className="mt-2 text-2xl font-extrabold text-foreground">Create your account</h1>
          <p className="mt-1 text-sm text-muted">
            You&apos;ll get an individual organization automatically on signup.
          </p>
        </div>

        <div className="mt-6 flex items-center">
          {WIZARD_STEPS.map((step, index) => (
            <div key={step.label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-extrabold ${
                    step.active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted"
                  }`}
                >
                  {index + 1}
                </div>
                <span
                  className={`whitespace-nowrap text-[10px] font-semibold ${
                    step.active ? "text-primary" : "text-muted"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < WIZARD_STEPS.length - 1 && <div className="mb-5 h-0.5 flex-1 bg-border" />}
            </div>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-6 rounded-xl border border-border bg-surface p-5">
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
              Full name <span className="text-error">*</span>
            </label>
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              placeholder="Alice Smith"
              autoComplete="name"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
              Email address <span className="text-error">*</span>
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              placeholder="alice@example.com"
              autoComplete="email"
            />
            <p className="mt-1 text-xs text-muted">Your login — must be unique across the platform.</p>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
              Password <span className="text-error">*</span>
            </label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              autoComplete="new-password"
            />
            {password.length > 0 && (
              <div className="mt-2">
                <div className="h-1 overflow-hidden rounded bg-background">
                  <div
                    className={`h-full rounded ${strength.ok ? "bg-success" : "bg-warning"} ${strength.width}`}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px]">
                  <span className={strength.ok ? "text-success" : "text-muted"}>{strength.label}</span>
                  <span className="text-muted">{password.length} chars</span>
                </div>
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
              Confirm password <span className="text-error">*</span>
            </label>
            <input
              required
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              autoComplete="new-password"
            />
          </div>

          <div className="my-4 h-px bg-border" />

          <label className="mb-5 flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--primary)]"
            />
            <span className="text-sm leading-relaxed text-muted">
              I agree to the <span className="text-primary">Terms of Service</span> and{" "}
              <span className="text-primary">Privacy Policy</span>
            </span>
          </label>

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
            {submitting ? "Creating account…" : "Continue — verify email →"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </main>
    </div>
    </RedirectIfAuthenticated>
  );
}
