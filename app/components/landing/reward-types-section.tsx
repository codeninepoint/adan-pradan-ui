import { HoverCard } from "@/components/landing/hover-card";
import { IconContainer, LandingIcon } from "@/components/landing/landing-icons";
import type { IconKey } from "@/components/landing/landing-icons";
import { rewardTypes } from "@/lib/landing-content";

const titleAccent = {
  primary: "text-primary",
  secondary: "text-secondary",
  success: "text-success",
  warning: "text-warning",
} as const;

const borderAccent = {
  primary: "border-primary/25",
  secondary: "border-secondary/25",
  success: "border-success/25",
  warning: "border-warning/25",
} as const;

const iconAccent = {
  primary: "text-primary",
  secondary: "text-secondary",
  success: "text-success",
  warning: "text-warning",
} as const;

type RewardItem = (typeof rewardTypes)[number];

type RewardTypesSectionProps = {
  items?: RewardItem[];
  embedded?: boolean;
};

export function RewardTypesSection({
  items = rewardTypes,
  embedded = false,
}: RewardTypesSectionProps) {
  const grid = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {items.map((item) => (
        <HoverCard
          key={item.title}
          as="article"
          className={`rounded-xl border bg-background p-5 ${borderAccent[item.accent]}`}
        >
          <IconContainer>
            <LandingIcon
              name={item.iconKey as IconKey}
              className={`h-5 w-5 ${iconAccent[item.accent]}`}
            />
          </IconContainer>
          <h3
            className={`mt-4 text-sm font-bold ${titleAccent[item.accent]}`}
          >
            {item.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {item.description}
          </p>
        </HoverCard>
      ))}
    </div>
  );

  if (embedded) return grid;

  return (
    <section className="rounded-xl border border-border bg-surface p-6 sm:p-8">
      {grid}
    </section>
  );
}
