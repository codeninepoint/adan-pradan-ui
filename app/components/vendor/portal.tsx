"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, marketplaceApi, vendorApi } from "@/lib/api";
import { clearVendorId, saveVendorId } from "@/lib/session";

export type VendorProfile = {
  vendor_id: string;
  org_id: string;
  status: string;
  legal_name: string;
};

type VendorPortalValue = {
  ready: boolean;
  vendor: VendorProfile | null;
  adopt: (vendor: VendorProfile) => void;
};

const VendorPortalContext = createContext<VendorPortalValue | null>(null);

export function useVendorPortal(): VendorPortalValue {
  const value = useContext(VendorPortalContext);
  if (!value) throw new Error("useVendorPortal must be used within VendorPortalProvider");
  return value;
}

export function VendorPortalProvider({ children }: { children: ReactNode }) {
  const { ready: authReady, profile, ensureAccessToken } = useAuth();
  const [ready, setReady] = useState(false);
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const lookupGeneration = useRef(0);

  useEffect(() => {
    if (!authReady) return;
    const generation = lookupGeneration.current;
    let cancelled = false;
    const orgs = profile?.organizations ?? [];
    void (async () => {
      for (const org of orgs) {
        try {
          const found = await vendorApi.forOrg(org.org_id, ensureAccessToken);
          if (cancelled || lookupGeneration.current !== generation) return;
          saveVendorId(found.vendor_id);
          setVendor(found);
          setReady(true);
          return;
        } catch (err) {
          if (err instanceof ApiError && (err.status === 404 || err.status === 403)) continue;
          if (!cancelled && lookupGeneration.current === generation) {
            setVendor(null);
            setReady(true);
          }
          return;
        }
      }
      if (!cancelled && lookupGeneration.current === generation) {
        clearVendorId();
        setVendor(null);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, profile, ensureAccessToken]);

  const adopt = (next: VendorProfile) => {
    lookupGeneration.current += 1;
    saveVendorId(next.vendor_id);
    setVendor(next);
    setReady(true);
  };

  const value = useMemo(() => ({ ready, vendor, adopt }), [ready, vendor]);

  return <VendorPortalContext.Provider value={value}>{children}</VendorPortalContext.Provider>;
}

type NavItem = { href: string; label: string; badge?: string };

function buildNav(
  pendingPluginReviews?: number,
  pendingReturns?: number,
): { label: string; items: NavItem[] }[] {
  const myPluginsBadge =
    pendingPluginReviews && pendingPluginReviews > 0 ? String(pendingPluginReviews) : undefined;
  const returnsBadge =
    pendingReturns && pendingReturns > 0 ? String(pendingReturns) : undefined;
  return [
  {
    label: "Main",
    items: [
      { href: "/app/vendor", label: "Overview" },
      { href: "/app/vendor/analytics", label: "Analytics" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/app/vendor/products", label: "Products" },
      { href: "/app/vendor/inventory", label: "Inventory" },
      { href: "/app/vendor/locations", label: "Locations & Pincodes", badge: "NEW" },
    ],
  },
  {
    label: "Plugins",
    items: [
      { href: "/app/vendor/platform-plugins", label: "Platform Plugins" },
      { href: "/app/vendor/my-plugins", label: "My Plugins", badge: myPluginsBadge },
    ],
  },
  {
    label: "Orders & fulfilment",
    items: [
      { href: "/app/vendor/orders", label: "Orders" },
      { href: "/app/vendor/fulfilment", label: "Fulfilment" },
      { href: "/app/vendor/returns", label: "Returns & Refunds", badge: returnsBadge },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/app/vendor/customers", label: "Customers" },
      { href: "/app/vendor/reviews", label: "Reviews" },
      { href: "/app/vendor/promotions", label: "Promotions" },
    ],
  },
  {
    label: "Payments",
    items: [{ href: "/app/vendor/payments", label: "Payments & Settlements" }],
  },
  {
    label: "Account",
    items: [
      { href: "/app/vendor/account", label: "Account & Identity" },
      { href: "/app/vendor/notifications", label: "Notifications" },
      { href: "/app/vendor/support", label: "Support" },
      { href: "/app/vendor/settings", label: "Vendor Settings" },
    ],
  },
];
}

function VendorShell({ vendor, children }: { vendor: VendorProfile; children: ReactNode }) {
  const pathname = usePathname();
  const { ensureAccessToken } = useAuth();
  const verified = vendor.status === "verified";
  const [pendingPluginReviews, setPendingPluginReviews] = useState<number | undefined>(undefined);
  const [pendingReturns, setPendingReturns] = useState<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void marketplaceApi
      .portal(vendor.vendor_id, ensureAccessToken)
      .then((data) => {
        if (!cancelled) setPendingPluginReviews(data.pending_plugin_reviews);
      })
      .catch(() => {
        if (!cancelled) setPendingPluginReviews(undefined);
      });
    void marketplaceApi
      .vendorReturns(vendor.vendor_id, ensureAccessToken)
      .then((data) => {
        if (!cancelled) {
          setPendingReturns(data.returns.filter((item) => item.status === "requested").length);
        }
      })
      .catch(() => {
        if (!cancelled) setPendingReturns(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [vendor.vendor_id, ensureAccessToken]);

  const nav = useMemo(
    () => buildNav(pendingPluginReviews, pendingReturns),
    [pendingPluginReviews, pendingReturns],
  );

  return (
    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 bg-background md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col border-b border-border bg-surface md:min-h-full md:border-b-0 md:border-r">
        <div className="hidden px-4 pb-2 pt-4 md:block">
          <p className="text-sm font-bold text-foreground">Vendor portal</p>
          <p className={`mt-1 text-xs font-semibold ${verified ? "text-success" : "text-muted"}`}>
            {verified ? "Verified vendor" : vendor.status}
          </p>
        </div>
        <nav className="flex gap-2 overflow-x-auto p-3 md:block md:flex-1 md:p-3">
          {nav.map((section) => (
            <div key={section.label} className="md:mb-4">
              <p className="hidden px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted md:block">
                {section.label}
              </p>
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-lg border-l-2 px-3 py-2 text-sm ${
                      active
                        ? "border-primary bg-[var(--hero-tint)] font-bold text-foreground"
                        : "border-transparent text-muted hover:bg-[var(--hero-tint)] hover:text-foreground"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="hidden border-t border-border p-3 md:block">
          <Link
            href="/app/vendor/platform-plugins"
            className="block rounded-lg border border-border px-3 py-2 text-center text-sm font-bold text-primary"
          >
            Plugins
          </Link>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3">
          <p className="truncate text-sm font-semibold text-foreground">{vendor.legal_name}</p>
          <span className={`shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-semibold ${verified ? "text-success" : "text-muted"}`}>
            {verified ? "Verified" : vendor.status}
          </span>
        </div>
        <div className="px-5 py-6 md:px-7">{children}</div>
      </div>
    </div>
  );
}

export function VendorChrome({ children }: { children: ReactNode }) {
  const { ready, vendor } = useVendorPortal();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (ready && !vendor && pathname !== "/app/vendor") {
      router.replace("/app/vendor");
    }
  }, [ready, vendor, pathname, router]);

  if (!ready) {
    return <p className="px-6 py-10 text-sm text-muted">Loading your vendor…</p>;
  }
  if (!vendor) return children;
  return <VendorShell vendor={vendor}>{children}</VendorShell>;
}
