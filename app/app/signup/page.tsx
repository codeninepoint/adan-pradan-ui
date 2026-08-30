import Link from "next/link";

const WIZARD_STEPS = [
  { label: "Your details", active: true },
  { label: "Verify email", active: false },
  { label: "Ready", active: false },
] as const;

export default function SignupPage() {
  return (
    <div className="flex-1 bg-background text-foreground">
      <main className="mx-auto max-w-md px-4 py-10 sm:px-6">
        <Link
          href="/"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Back to home
        </Link>

        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Step 1 of 3
          </p>
          <h1 className="mt-2 text-2xl font-extrabold text-foreground">
            Create your account
          </h1>
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
                  className={`text-[10px] font-semibold whitespace-nowrap ${
                    step.active ? "text-primary" : "text-muted"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < WIZARD_STEPS.length - 1 && (
                <div className="mb-5 h-0.5 flex-1 bg-border" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-border bg-surface p-5">
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
              Full name <span className="text-error">*</span>
            </label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              defaultValue="Alice Smith"
              readOnly
            />
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
              Email address <span className="text-error">*</span>
            </label>
            <input
              type="email"
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              defaultValue="alice@example.com"
              readOnly
            />
            <p className="mt-1 text-xs text-muted">
              Your login — must be unique across the platform.
            </p>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
              Password <span className="text-error">*</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                🔒
              </span>
              <input
                type="password"
                className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3.5 text-sm text-foreground outline-none focus:border-primary"
                defaultValue="●●●●●●●●●●●●"
                readOnly
              />
            </div>
            <div className="mt-2">
              <div className="h-1 overflow-hidden rounded bg-background">
                <div className="h-full w-4/5 rounded bg-success" />
              </div>
              <div className="mt-1 flex justify-between text-[10px]">
                <span className="text-success">Strong password</span>
                <span className="text-muted">12 chars</span>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
              Confirm password <span className="text-error">*</span>
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              defaultValue="●●●●●●●●●●●●"
              readOnly
            />
          </div>

          <div className="my-4 h-px bg-border" />

          <label className="mb-5 flex cursor-pointer items-start gap-2.5">
            <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2 border-primary bg-primary text-[11px] text-primary-foreground">
              ✓
            </span>
            <span className="text-sm leading-relaxed text-muted">
              I agree to the{" "}
              <span className="text-primary">Terms of Service</span> and{" "}
              <span className="text-primary">Privacy Policy</span>
            </span>
          </label>

          <button
            type="button"
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Continue — verify email →
          </button>

          <div className="my-4 flex items-center gap-2.5 text-xs text-muted">
            <div className="h-px flex-1 bg-border" />
            or sign up with
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              className="rounded-lg border border-border py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--hero-tint)]"
            >
              🔵 Google
            </button>
            <button
              type="button"
              className="rounded-lg border border-border py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--hero-tint)]"
            >
              ⬛ GitHub
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{" "}
          <a href="#" className="text-primary">
            Sign in
          </a>
        </p>
      </main>
    </div>
  );
}
