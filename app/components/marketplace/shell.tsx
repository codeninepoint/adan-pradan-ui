"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { marketplaceApi } from "@/lib/api";

const NAV = [
  {
    label: "Discover",
    items: [
      { href: "/app/marketplace", label: "Marketplace Home" },
      { href: "/app/marketplace/browse", label: "Browse All" },
      { href: "/app/marketplace/wishlist", label: "Wishlist" },
      { href: "/app/marketplace/cart", label: "Cart" },
    ],
  },
  {
    label: "My Marketplace",
    items: [
      { href: "/app/marketplace/installs", label: "My Installs" },
      { href: "/app/marketplace/orders", label: "Orders & Tracking" },
      { href: "/app/marketplace/returns", label: "Returns & Refunds" },
      { href: "/app/marketplace/billing", label: "Subscriptions & Billing" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/app/marketplace/addresses", label: "Addresses" },
      { href: "/app/marketplace/settings", label: "Settings" },
    ],
  },
];

export function StorefrontShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { tenantId, ensureAccessToken } = useAuth();
  const [count, setCount] = useState(0);
  const [query, setQuery] = useState("");
  const [deliverTo, setDeliverTo] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    const id = tenantId;
    let cancelled = false;

    function loadCart() {
      void marketplaceApi
        .cart(id, ensureAccessToken)
        .then((cart) => {
          if (!cancelled) setCount(cart.lines.reduce((sum, line) => sum + line.quantity, 0));
        })
        .catch(() => {
          if (!cancelled) setCount(0);
        });
    }

    function loadAddress() {
      void marketplaceApi
        .addresses(id, ensureAccessToken)
        .then((data) => {
          if (cancelled) return;
          const first = data.addresses[0];
          setDeliverTo(first ? `${first.city} ${first.pincode}` : null);
        })
        .catch(() => {
          if (!cancelled) setDeliverTo(null);
        });
    }

    loadCart();
    loadAddress();
    window.addEventListener("marketplace-cart", loadCart);
    window.addEventListener("marketplace-address", loadAddress);
    return () => {
      cancelled = true;
      window.removeEventListener("marketplace-cart", loadCart);
      window.removeEventListener("marketplace-address", loadAddress);
    };
  }, [tenantId, ensureAccessToken, pathname]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/app/marketplace/browse?q=${encodeURIComponent(q)}` : "/app/marketplace/browse");
  }

  return (
    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 bg-background md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col border-b border-border bg-surface md:min-h-full md:border-b-0 md:border-r">
        <nav className="flex gap-2 overflow-x-auto p-3 md:block md:flex-1 md:p-3">
          {NAV.map((section) => (
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
                    className={`flex items-center justify-between whitespace-nowrap rounded-lg border-l-2 px-3 py-2 text-sm ${
                      active
                        ? "border-primary bg-[var(--hero-tint)] font-bold text-foreground"
                        : "border-transparent text-muted hover:bg-[var(--hero-tint)] hover:text-foreground"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.href.endsWith("/cart") && count > 0 && (
                      <span className="ml-2 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {count}
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
            href="/app/vendor"
            className="block rounded-lg border border-border px-3 py-2 text-center text-sm font-bold text-primary"
          >
            Become a vendor
          </Link>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="flex items-center gap-3 border-b border-border bg-surface px-5 py-3">
          <form onSubmit={onSearch} className="min-w-0 flex-1">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products, courses, services…"
              className="w-full max-w-xl rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </form>
          <Link href="/app/marketplace/addresses" className="hidden shrink-0 text-right sm:block">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-muted">Deliver to</span>
            <span className="text-sm font-semibold text-foreground">{deliverTo ?? "Add address"}</span>
          </Link>
          <Link
            href="/app/marketplace/cart"
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border text-foreground"
            aria-label={count > 0 ? `Cart, ${count} items` : "Cart"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6h15l-1.5 9h-12z" />
              <path d="M6 6 5 3H2" />
              <circle cx="9" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
            </svg>
            {count > 0 && (
              <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
        </div>
        <div className="px-5 py-6 md:px-7">{children}</div>
      </div>
    </div>
  );
}
