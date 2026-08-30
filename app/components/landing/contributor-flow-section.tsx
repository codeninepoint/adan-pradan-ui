import { Fragment } from "react";
import { IconChevronDown } from "@/components/landing/icon-chevron-down";
import { IconChevronRight } from "@/components/landing/icon-chevron-right";
import { HoverCard } from "@/components/landing/hover-card";
import { IconContainer, LandingIcon } from "@/components/landing/landing-icons";
import { RewardTypesSection } from "@/components/landing/reward-types-section";
import { SectionHeading } from "@/components/landing/section-heading";
import { contributorFlow, rewardTypes } from "@/lib/landing-content";

const stepCardClass =
  "flex min-h-[140px] w-full flex-1 flex-col items-center justify-center rounded-xl border px-3 py-4 text-center lg:min-w-0 hover:!translate-y-0 hover:!scale-100 hover:shadow-md";

export function ContributorFlowSection() {
  const steps = contributorFlow.steps;

  return (
    <section className="rounded-xl border border-border bg-surface p-6 sm:p-8">
      <SectionHeading title={contributorFlow.title} eyebrow="Contributor economy" />

      <div className="mt-6 flex flex-col items-stretch lg:flex-row lg:items-stretch">
        {steps.map((step, index) => (
          <Fragment key={step.title}>
            <HoverCard
              className={`${stepCardClass} ${
                step.highlight
                  ? "border-success/30 bg-success/5"
                  : "border-border bg-background"
              }`}
            >
              <IconContainer className="mx-auto">
                <LandingIcon
                  name={step.iconKey}
                  className={`h-5 w-5 ${step.highlight ? "text-success" : "text-primary"}`}
                />
              </IconContainer>
              <div
                className={`mt-3 line-clamp-2 text-sm font-bold ${
                  step.highlight ? "text-success" : "text-foreground"
                }`}
              >
                {step.title}
              </div>
              <div className="mt-1 line-clamp-2 text-xs text-muted">
                {step.subtitle}
              </div>
            </HoverCard>

            {index < steps.length - 1 && (
              <div
                className="flex h-8 w-full shrink-0 items-center justify-center lg:h-auto lg:w-8"
                aria-hidden
              >
                <IconChevronDown className="text-muted lg:hidden" />
                <IconChevronRight className="hidden text-muted lg:block" />
              </div>
            )}
          </Fragment>
        ))}
      </div>

      <div className="mt-5 flex gap-3 rounded-xl border border-primary/20 bg-[var(--hero-tint)] p-4 text-sm leading-relaxed text-foreground">
        <IconContainer className="shrink-0">
          <LandingIcon name="info" className="h-5 w-5 text-primary" />
        </IconContainer>
        <p>
          Revenue is split transparently using the{" "}
          <strong>
            MarketplaceOffering → plan_id → PlanPricingDimension
          </strong>{" "}
          chain. The platform takes a fixed governance fee; the rest flows to
          contributors based on usage.
        </p>
      </div>

      <div className="mt-6">
        <RewardTypesSection items={rewardTypes} embedded />
      </div>
    </section>
  );
}
