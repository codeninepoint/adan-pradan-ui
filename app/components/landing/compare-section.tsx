import { HoverCard } from "@/components/landing/hover-card";
import { compare } from "@/lib/landing-content";

export function CompareSection() {
  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <HoverCard
        as="article"
        className="rounded-xl border border-error/20 bg-error/5 p-6"
      >
        <h2 className="text-sm font-bold text-error">{compare.notTitle}</h2>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
          {compare.notItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </HoverCard>

      <HoverCard
        as="article"
        className="rounded-xl border border-success/20 bg-success/5 p-6"
      >
        <h2 className="text-sm font-bold text-success">{compare.areTitle}</h2>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
          {compare.areItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </HoverCard>
    </section>
  );
}
