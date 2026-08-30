import { HoverCard } from "@/components/landing/hover-card";
import { IconContainer, LandingIcon } from "@/components/landing/landing-icons";
import { mission, vision } from "@/lib/landing-content";

export function MissionVisionSection() {
  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <HoverCard
        as="article"
        className="rounded-xl border border-secondary/30 bg-surface p-6"
      >
        <IconContainer>
          <LandingIcon
            name={vision.iconKey}
            className="h-5 w-5 text-secondary"
          />
        </IconContainer>
        <h2 className="mt-4 text-base font-bold text-secondary">
          {vision.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {vision.description}
        </p>
      </HoverCard>

      <HoverCard
        as="article"
        className="rounded-xl border border-primary/30 bg-surface p-6"
      >
        <IconContainer>
          <LandingIcon name={mission.iconKey} className="h-5 w-5 text-primary" />
        </IconContainer>
        <h2 className="mt-4 text-base font-bold text-primary">{mission.title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {mission.description}
        </p>
      </HoverCard>
    </section>
  );
}
