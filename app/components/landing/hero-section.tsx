import Link from "next/link";
import { hero } from "@/lib/landing-content";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-[var(--hero-tint)] p-8 sm:p-12">
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-secondary/10 blur-3xl" />

      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
          {hero.tag}
        </p>
        <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
          {hero.headline}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          {hero.subtext}
        </p>
        <div className="mt-10">
          <Link
            href="/signup"
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground shadow-md transition-all hover:scale-105 hover:bg-primary-hover hover:shadow-lg"
          >
            Create account →
          </Link>
        </div>
      </div>
    </section>
  );
}
