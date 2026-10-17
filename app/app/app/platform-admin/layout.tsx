"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/auth-guards";
import { useAuth } from "@/components/auth-provider";
import { platformAdminApi } from "@/lib/api";

const ROLE_NAV: Record<string, string[]> = {
  super_admin: ["*"],
  platform_admin: ["*"],
  finance_manager: ["Analytics & Ops", "System"],
  content_moderator: ["Marketplace", "Governance"],
  kyc_reviewer: ["Marketplace"],
  support_agent: ["Analytics & Ops", "Users & Access"],
};

const ROLE_ALIASES: Record<string, string> = {
  catalog_manager: "content_moderator",
  support: "support_agent",
};

const NAV = [
  {
    section: "Governance",
    items: [
      { href: "/app/platform-admin/plugins", label: "Plugin Review" },
      { href: "/app/platform-admin/standard-plugins", label: "Standard Plugins" },
      { href: "/app/platform-admin/approve-versions", label: "Approve Versions" },
    ],
  },
  {
    section: "Marketplace",
    items: [
      { href: "/app/platform-admin/vendors", label: "Vendors" },
      { href: "/app/platform-admin/tenants", label: "Tenants" },
      { href: "/app/platform-admin/products", label: "Products" },
    ],
  },
  {
    section: "Analytics & Ops",
    items: [
      { href: "/app/platform-admin/dashboard", label: "Dashboard" },
      { href: "/app/platform-admin/analytics", label: "Analytics" },
      { href: "/app/platform-admin/audit", label: "Audit Log" },
    ],
  },
  {
    section: "System",
    items: [
      { href: "/app/platform-admin/policies", label: "Policies" },
      { href: "/app/platform-admin/config", label: "Config" },
    ],
  },
  {
    section: "Platform Team",
    items: [{ href: "/app/platform-admin/team", label: "Team Management" }],
  },
  {
    section: "Users & Access",
    items: [
      { href: "/app/platform-admin/users", label: "All Users" },
      { href: "/app/platform-admin/roles", label: "Roles & Permissions" },
      { href: "/app/platform-admin/account-types", label: "Account Types" },
    ],
  },
];

function resolveNavRole(platformRole: string | null): string | null {
  if (!platformRole) return null;
  return ROLE_ALIASES[platformRole] ?? platformRole;
}

function filterNav(platformRole: string | null) {
  const role = resolveNavRole(platformRole);
  if (!role) return NAV;
  const allowed = ROLE_NAV[role];
  if (!allowed || allowed.includes("*")) return NAV;
  return NAV.filter((group) => allowed.includes(group.section));
}

function PlatformAdminShell({ children }: { children: React.ReactNode }) {
  const { profile, ensureAccessToken } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isOperator = Boolean(profile?.is_platform_operator);
  const [teamRole, setTeamRole] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !isOperator) {
      router.replace("/app");
    }
  }, [profile, isOperator, router]);

  useEffect(() => {
    if (!profile?.email || !isOperator) return;
    void platformAdminApi
      .team(ensureAccessToken)
      .then((data) => {
        const member = data.items.find(
          (item) => item.email.toLowerCase() === profile.email.toLowerCase(),
        );
        setTeamRole(member?.platform_role ?? null);
      })
      .catch(() => {
        setTeamRole(null);
      });
  }, [profile?.email, isOperator, ensureAccessToken]);

  const visibleNav = useMemo(() => filterNav(teamRole), [teamRole]);
  const roleLabel = teamRole ? teamRole.replace(/_/g, " ") : "Platform operator";

  if (!profile) {
    return <div className="flex flex-1 items-center justify-center text-sm text-muted">Loading…</div>;
  }
  if (!isOperator) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-xl font-bold">Platform Admin</h1>
        <p className="mt-2 text-sm text-muted">This area is for platform operators only.</p>
        <Link href="/app" className="mt-4 inline-block font-semibold text-primary hover:underline">
          Back to app
        </Link>
      </main>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-1 bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface md:flex md:flex-col">
        <div className="border-b border-border px-4 py-4">
          <p className="text-sm font-extrabold tracking-tight">AdanPradan</p>
          <p className="text-xs text-muted">FairShare · Platform Admin</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {visibleNav.map((group) => (
            <div key={group.section} className="mb-4">
              <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                {group.section}
              </p>
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`mb-0.5 block rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-primary/15 font-semibold text-primary"
                        : "text-muted hover:bg-background hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-border px-4 py-3 text-xs">
          <p className="truncate font-medium">{profile.email}</p>
          <p className="text-muted capitalize">{roleLabel}</p>
          <Link href="/app" className="mt-2 inline-block text-primary hover:underline">
            Exit to app
          </Link>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex gap-2 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
          {visibleNav.flatMap((g) => g.items).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                pathname === item.href ? "bg-primary text-primary-foreground" : "bg-surface text-muted"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <PlatformAdminShell>{children}</PlatformAdminShell>
    </RequireAuth>
  );
}
