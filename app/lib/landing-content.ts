import type { IconKey } from "@/components/landing/landing-icons";

export const hero = {
  tag: "About TenantPlatform",
  headline: "A platform where every contributor is an owner",
  subtext:
    "We are building a cloud marketplace where the people who create value — plugin authors, integration builders, and service architects — share in the rewards they generate, not just the employees of a corporation.",
};

export const mission = {
  iconKey: "target" as IconKey,
  title: "Our Mission",
  description:
    "To build a multi-tenant cloud platform where any individual, team, or organization can publish technical services — plugins, integrations, and offerings — and earn a fair, transparent share of the revenue they generate, governed by code and not by corporate hierarchy.",
};

export const vision = {
  iconKey: "globe" as IconKey,
  title: "Our Vision",
  description:
    "A world where the platform is a commons — not a landlord. Every contributor who builds something that delivers value receives a proportional, automatic reward. The ecosystem grows because the people who grow it benefit directly.",
};

export const quote = {
  headline: '"Contributors, not employees. Owners, not tenants."',
  body: "Anyone who ships a plugin, integration, or service that earns revenue on this platform is a stakeholder — not a vendor subject to arbitrary platform fees, and not an employee subject to a payroll.",
};

export const contributorFlow = {
  title: "How contributor rewards work",
  steps: [
    {
      iconKey: "plug" as IconKey,
      title: "You build a plugin",
      subtitle: "ServicePlugin + PluginVersion",
    },
    {
      iconKey: "shopping-bag" as IconKey,
      title: "Tenants subscribe",
      subtitle: "Entitlement + Subscription",
    },
    {
      iconKey: "bar-chart" as IconKey,
      title: "Usage is metered",
      subtitle: "UsageEvent + Aggregation",
    },
    {
      iconKey: "coins" as IconKey,
      title: "You earn a share",
      subtitle: "Automatic, transparent",
      highlight: true,
    },
  ],
  infoAlert:
    "Revenue is split transparently using the MarketplaceOffering → plan_id → PlanPricingDimension chain. The platform takes a fixed governance fee; the rest flows to contributors based on usage.",
};

export const rewardTypes = [
  {
    iconKey: "plug" as IconKey,
    title: "Plugin Authors",
    description:
      "Earn from subscriptions and usage metering of your published plugin versions. More installs = more earnings. Every version you ship accrues independently.",
    accent: "warning" as const,
  },
  {
    iconKey: "blocks" as IconKey,
    title: "Integration Builders",
    description:
      "Build on top of existing plugins, add value, and resell as your own offering. The revenue chain is auditable — upstream contributors receive their share automatically.",
    accent: "primary" as const,
  },
  {
    iconKey: "sprout" as IconKey,
    title: "Ecosystem Growers",
    description:
      "Governance, documentation, testing, and community work can be tokenized and rewarded through platform decisions — not just code contributors.",
    accent: "success" as const,
  },
];

export const principles = {
  title: "Platform principles",
  columns: ["Principle", "What it means in practice", "Platform mechanism"],
  rows: [
    {
      principle: "Equal contribution reward",
      practice:
        "If your plugin generates $1,000 in subscriptions, your share is calculated by formula — not negotiation",
      mechanism: "PlanPricingDimension + revenue split config",
      accent: "primary" as const,
    },
    {
      principle: "Transparent metering",
      practice:
        "Every usage event is recorded immutably. No hidden aggregation or rounding",
      mechanism: "UsageEvent (append-only, idempotent)",
      accent: "secondary" as const,
    },
    {
      principle: "No gatekeeping",
      practice:
        "Any verified vendor can publish. Platform governance approves for quality — not to pick winners",
      mechanism: "PluginVersion governance pipeline",
      accent: "warning" as const,
    },
    {
      principle: "Value chain auditable",
      practice:
        "When a tenant-vendor resells your plugin, the original author's share is preserved in the chain",
      mechanism: "ISVVariant revenue split + AuditLog",
      accent: "warning" as const,
    },
    {
      principle: "Contributors own history",
      practice:
        "Your plugin versions, contribution records, and earnings history are permanent — even if you leave",
      mechanism: "PluginVersion immutability + AuditLog",
      accent: "success" as const,
    },
  ],
};

export const compare = {
  notTitle: "❌ What we are not",
  notItems: [
    "✗ An employer-employee model",
    "✗ A closed marketplace where we pick what succeeds",
    "✗ A platform that takes 30–70% with no transparency",
    "✗ A system where early employees earn forever",
    "✗ A place where only corporations can be vendors",
  ],
  areTitle: "✅ What we are",
  areItems: [
    "✓ A contributor-governed platform commons",
    "✓ Open to any verified individual or organization",
    "✓ Transparent revenue sharing by formula",
    "✓ Metered fairly — you earn what you generate",
    "✓ Solo founders welcome alongside enterprises",
  ],
};

export const cta = {
  title: "Ready to contribute?",
  description:
    "Start as an individual, upgrade to an organization when you need a team, and enable vendor participation when you're ready to publish. Your contributor journey is recorded, versioned, and permanent.",
  primaryLabel: "Create account →",
  secondaryLabels: ["Enable vendor access", "See Individual dashboard"],
};
