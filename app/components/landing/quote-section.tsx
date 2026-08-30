import { HoverCard } from "@/components/landing/hover-card";
import { quote } from "@/lib/landing-content";

export function QuoteSection() {
  return (
    <HoverCard
      as="blockquote"
      className="rounded-r-xl border border-border border-l-4 border-l-primary bg-surface px-6 py-5"
    >
      <p className="text-lg font-semibold leading-snug text-foreground">
        {quote.headline}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">{quote.body}</p>
    </HoverCard>
  );
}
