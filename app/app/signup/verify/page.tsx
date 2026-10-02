"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, authApi } from "@/lib/api";
import { clearPendingSignup, getPendingSignup } from "@/lib/session";

const WIZARD_STEPS = [
  { label: "Your details", active: false },
  { label: "Verify email", active: true },
  { label: "Ready", active: false },
] as const;

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [devHint, setDevHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const pending = getPendingSignup();
    if (!pending?.email) {
      router.replace("/signup");
      return;
    }
    setEmail(pending.email);
    if (pending.dev_otp) {
      setDevHint(pending.dev_otp);
      setOtp(pending.dev_otp);
    }
    setReady(true);
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authApi.verifyEmail({ email, otp_code: otp.trim() });
      clearPendingSignup();
      router.push(`/login?email=${encodeURIComponent(email)}&verified=1`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Verification failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background text-sm text-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background text-foreground">
      <main className="mx-auto max-w-md px-4 py-10 sm:px-6">
        <Link href="/signup" className="text-sm font-medium text-primary hover:underline">
          ← Back
        </Link>

        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Step 2 of 3</p>
          <h1 className="mt-2 text-2xl font-extrabold text-foreground">Verify your email</h1>
          <p className="mt-1 text-sm text-muted">
            Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>.
          </p>
        </div>

        <div className="mt-6 flex items-center">
          {WIZARD_STEPS.map((step, index) => (
            <div key={step.label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-extrabold ${
                    step.active || index === 0
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted"
                  }`}
                >
                  {index + 1}
                </div>
                <span
                  className={`whitespace-nowrap text-[10px] font-semibold ${
                    step.active || index === 0 ? "text-primary" : "text-muted"
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
          {devHint && (
            <p className="mb-4 rounded-lg border border-border bg-[var(--hero-tint)] px-3 py-2 text-xs text-muted">
              <span className="mb-1 inline-block rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                Dev only
              </span>
              <br />
              Email delivery is not wired. Use OTP{" "}
              <span className="font-mono font-semibold text-foreground">{devHint}</span>
            </p>
          )}

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
              Verification code <span className="text-error">*</span>
            </label>
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-foreground outline-none focus:border-primary"
              placeholder="••••••"
              autoComplete="one-time-code"
            />
          </div>

          {error && (
            <p className="mb-4 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || otp.length !== 6}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            {submitting ? "Verifying…" : "Verify email →"}
          </button>
        </form>
      </main>
    </div>
  );
}
