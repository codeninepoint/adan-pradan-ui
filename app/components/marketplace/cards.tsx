"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, marketplaceApi, type CatalogItem } from "@/lib/api";
import { formatMoney } from "@/lib/money";

const LABELS: Record<string, string> = {
  SHIP_PHYSICAL: "Physical",
  DELIVER_DIGITAL: "Digital",
  LICENSE_SOFTWARE: "Digital",
  PROVISION_SOFTWARE: "Digital",
  PROVISION_CLOUD: "Digital",
  STREAM_LMS_COURSE: "Digital",
  DELIVER_MULTIMEDIA: "Digital",
  DISPATCH_SERVICE: "Physical",
  BOOK_APPOINTMENT: "Physical",
};

export const FULFILMENT_CHIPS: { code: string; label: string }[] = [
  { code: "SHIP_PHYSICAL", label: "Ecommerce" },
  { code: "DELIVER_DIGITAL", label: "Digital Products" },
  { code: "LICENSE_SOFTWARE", label: "Software Products" },
  { code: "PROVISION_SOFTWARE", label: "Software & SaaS" },
  { code: "PROVISION_CLOUD", label: "Cloud Services" },
  { code: "STREAM_LMS_COURSE", label: "LMS & Courses" },
  { code: "DELIVER_MULTIMEDIA", label: "Multimedia" },
  { code: "DISPATCH_SERVICE", label: "Field Services" },
  { code: "BOOK_APPOINTMENT", label: "Appointments" },
];

export type CartLineRef = { line_id: string; quantity: number };

export function fulfilmentLabel(code: string): string {
  return LABELS[code] ?? code;
}

export function canInstall(code: string): boolean {
  return code === "PROVISION_SOFTWARE" || code === "PROVISION_CLOUD";
}

function money(amount: number, currency?: string): string {
  return formatMoney(amount, currency || "INR");
}

function notifyCart() {
  window.dispatchEvent(new Event("marketplace-cart"));
}

export function ProductCard({
  item,
  onView,
  cartLine,
}: {
  item: CatalogItem;
  onView?: (productId: string) => void;
  cartLine?: CartLineRef | null;
}) {
  const { tenantId, ensureAccessToken } = useAuth();
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const install = canInstall(item.fulfilment_type);
  const rating = item.avg_rating ?? 0;
  const reviewCount = item.review_count ?? 0;
  const inCart = Boolean(cartLine);

  async function save() {
    if (!tenantId) return;
    setNote(null);
    try {
      await marketplaceApi.saveWishlist(tenantId, item.product_id, ensureAccessToken);
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSaved(true);
        return;
      }
      setNote(err instanceof ApiError ? err.detail : "Could not save.");
    }
  }

  async function add() {
    if (!tenantId || busy) return;
    setNote(null);
    setBusy(true);
    try {
      await marketplaceApi.addCartLine(
        tenantId,
        { offering_id: item.offering_id, quantity: 1 },
        ensureAccessToken,
      );
      notifyCart();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        notifyCart();
        return;
      }
      setNote(err instanceof ApiError ? err.detail : "Could not add to cart.");
    } finally {
      setBusy(false);
    }
  }

  async function bump(delta: number) {
    if (!tenantId || !cartLine || busy) return;
    setNote(null);
    setBusy(true);
    try {
      const next = cartLine.quantity + delta;
      if (next < 1) {
        await marketplaceApi.removeCartLine(tenantId, cartLine.line_id, ensureAccessToken);
      } else if (next > 10) {
        return;
      } else {
        await marketplaceApi.updateCartLine(
          tenantId,
          cartLine.line_id,
          next,
          ensureAccessToken,
        );
      }
      notifyCart();
    } catch (err) {
      setNote(err instanceof ApiError ? err.detail : "Could not update cart.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="relative flex h-28 items-end bg-[var(--hero-tint)] p-3">
        <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
          {fulfilmentLabel(item.fulfilment_type)}
        </span>
        <button
          type="button"
          aria-label={saved ? "Saved to wishlist" : "Save to wishlist"}
          onClick={() => void save()}
          className={`absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface/80 ${saved ? "text-primary" : "text-muted"}`}
        >
          <Heart filled={saved} />
        </button>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs text-muted">{item.vendor}</p>
        <p className="mt-1 font-semibold text-foreground">{item.product_name}</p>
        <p className="mt-2 text-sm text-foreground">
          from {money(item.price ?? item.price_usd, item.currency)}
        </p>
        <p className="mt-1 flex items-center gap-2 text-xs text-muted">
          {reviewCount > 0 ? (
            <span>
              ★ {rating.toFixed(1)} ({reviewCount})
            </span>
          ) : (
            <span>No reviews yet</span>
          )}
          <span>·</span>
          <span>{fulfilmentLabel(item.fulfilment_type)}</span>
        </p>
        {note && <p className="mt-2 text-xs text-muted">{note}</p>}
        <div className="mt-auto flex gap-2 pt-4">
          <button
            type="button"
            onClick={() => (onView ? onView(item.product_id) : undefined)}
            className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-bold hover:border-primary"
          >
            View
          </button>
          {install ? (
            <Link
              href={`/app/marketplace/products/${item.product_id}`}
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-center text-xs font-bold text-primary-foreground"
            >
              Install
            </Link>
          ) : inCart && cartLine ? (
            <div className="flex flex-1 items-center justify-between rounded-lg border border-primary bg-surface px-1 py-1">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={busy}
                onClick={() => void bump(-1)}
                className="grid h-7 w-7 place-items-center rounded-md text-sm font-bold text-foreground hover:bg-[var(--hero-tint)] disabled:opacity-50"
              >
                −
              </button>
              <span className="min-w-6 text-center text-xs font-bold tabular-nums">
                {cartLine.quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={busy || cartLine.quantity >= 10}
                onClick={() => void bump(1)}
                className="grid h-7 w-7 place-items-center rounded-md text-sm font-bold text-foreground hover:bg-[var(--hero-tint)] disabled:opacity-50"
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void add()}
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              + Cart
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({
  items,
  empty = "Nothing is published in this view yet.",
  onView,
}: {
  items: CatalogItem[];
  empty?: string;
  onView?: (productId: string) => void;
}) {
  const { tenantId, ensureAccessToken } = useAuth();
  const [cartByOffering, setCartByOffering] = useState<Record<string, CartLineRef>>({});

  const refreshCart = useCallback(() => {
    if (!tenantId) {
      setCartByOffering({});
      return;
    }
    void marketplaceApi
      .cart(tenantId, ensureAccessToken)
      .then((cart) => {
        const map: Record<string, CartLineRef> = {};
        for (const line of cart.lines) {
          map[line.offering_id] = { line_id: line.line_id, quantity: line.quantity };
        }
        setCartByOffering(map);
      })
      .catch(() => setCartByOffering({}));
  }, [tenantId, ensureAccessToken]);

  useEffect(() => {
    refreshCart();
    window.addEventListener("marketplace-cart", refreshCart);
    return () => window.removeEventListener("marketplace-cart", refreshCart);
  }, [refreshCart]);

  if (items.length === 0) {
    return <p className="text-sm text-muted">{empty}</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <ProductCard
          key={item.offering_id}
          item={item}
          onView={onView}
          cartLine={cartByOffering[item.offering_id] ?? null}
        />
      ))}
    </div>
  );
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" />
    </svg>
  );
}
