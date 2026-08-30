import Link from "next/link";
import { cta } from "@/lib/landing-content";

export function CtaSection() {
  return (
    <section className="-mx-4 border-y border-border bg-[var(--hero-tint)] px-4 py-14 sm:-mx-6 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {cta.title}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
          {cta.description}
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/signup"
            className="inline-flex h-14 w-full items-center justify-center rounded-full bg-primary px-10 text-lg font-bold text-primary-foreground shadow-lg transition-all hover:scale-105 hover:bg-primary-hover hover:shadow-xl sm:w-auto"
          >
            {cta.primaryLabel}
          </Link>
          <button
            type="button"
            className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-surface px-6 text-sm font-semibold text-foreground transition-all hover:-translate-y-0.5 hover:shadow-md sm:w-auto"
          >
            {cta.secondaryLabels[0]}
          </button>
          <button
            type="button"
            className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-surface px-6 text-sm font-semibold text-foreground transition-all hover:-translate-y-0.5 hover:shadow-md sm:w-auto"
          >
            {cta.secondaryLabels[1]}
          </button>
        </div>
      </div>
    </section>
  );
}
