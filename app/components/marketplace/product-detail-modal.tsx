"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { canInstall, fulfilmentLabel, type CartLineRef } from "@/components/marketplace/cards";
import { ApiError, marketplaceApi } from "@/lib/api";
import { formatMoney } from "@/lib/money";

type Offering = {
  offering_id: string;
  plan_name: string;
  price: number;
  currency: string;
  billing_period: string;
};

type Review = {
  rating: number;
  comment: string;
  customer_name: string;
  created_at: string;
};

function notifyCart() {
  window.dispatchEvent(new Event("marketplace-cart"));
}

export function ProductDetailModal({
  productId,
  onClose,
}: {
  productId: string;
  onClose: () => void;
}) {
  const { tenantId, ensureAccessToken } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [fulfilmentType, setFulfilmentType] = useState("");
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"description" | "reviews" | "shipping">("description");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      marketplaceApi.product(productId),
      marketplaceApi.productReviews(productId),
    ])
      .then(([detail, reviewData]) => {
        if (cancelled) return;
        setName(detail.name);
        setDescription(detail.description);
        setVendor(detail.vendor);
        setFulfilmentType(detail.fulfilment_type);
        setContent(detail.content ?? {});
        setOfferings(detail.offerings);
        setSelected(detail.offerings[0]?.offering_id ?? null);
        setReviews(reviewData.reviews);
        setAvgRating(reviewData.avg_rating);
        setReviewCount(reviewData.review_count);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.detail : "Could not load product.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    refreshCart();
    window.addEventListener("marketplace-cart", refreshCart);
    return () => window.removeEventListener("marketplace-cart", refreshCart);
  }, [refreshCart]);

  const offering = offerings.find((o) => o.offering_id === selected) ?? offerings[0];
  const install = canInstall(fulfilmentType);
  const sku = typeof content.sku === "string" ? content.sku : null;
  const cartLine = offering ? cartByOffering[offering.offering_id] ?? null : null;

  async function addToCart() {
    if (!tenantId || !offering || busy) return;
    setNote(null);
    setBusy(true);
    try {
      await marketplaceApi.addCartLine(
        tenantId,
        { offering_id: offering.offering_id, quantity: qty },
        ensureAccessToken,
      );
      setNote(null);
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

  async function addWishlist() {
    if (!tenantId) return;
    setNote(null);
    try {
      await marketplaceApi.saveWishlist(tenantId, productId, ensureAccessToken);
      setNote("Saved to wishlist");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setNote("Already in wishlist");
        return;
      }
      setNote(err instanceof ApiError ? err.detail : "Could not save.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={name || "Product details"}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-lg font-bold">{loading ? "Loading…" : name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-2 py-1 text-sm text-muted hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && <p className="px-5 py-4 text-sm text-error">{error}</p>}

        {!loading && !error && (
          <div className="grid gap-6 p-5 md:grid-cols-[1fr_1.2fr]">
            <div className="flex min-h-40 items-center justify-center rounded-xl bg-[var(--hero-tint)] text-sm text-muted">
              Product image
            </div>
            <div>
              <p className="text-sm text-muted">{vendor}</p>
              <p className="mt-1 text-xs text-muted">
                {fulfilmentLabel(fulfilmentType)}
                {reviewCount > 0 ? ` · ★ ${avgRating.toFixed(1)} (${reviewCount})` : ""}
              </p>

              {offerings.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Select variant
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {offerings.map((o) => (
                      <button
                        key={o.offering_id}
                        type="button"
                        onClick={() => {
                          setSelected(o.offering_id);
                          setQty(1);
                          setNote(null);
                        }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                          selected === o.offering_id
                            ? "border-success bg-success/10 text-success"
                            : "border-border text-muted"
                        }`}
                      >
                        {o.plan_name} {formatMoney(o.price, o.currency)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {offering && (
                <p className="mt-4 text-2xl font-bold text-success">
                  {formatMoney(offering.price, offering.currency)}
                </p>
              )}

              {!install && !cartLine && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-xs font-semibold text-muted">Qty</span>
                  <div className="flex items-center rounded-lg border border-border">
                    <button
                      type="button"
                      className="px-3 py-1 text-sm"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center text-sm font-semibold">{qty}</span>
                    <button
                      type="button"
                      className="px-3 py-1 text-sm"
                      onClick={() => setQty((q) => Math.min(10, q + 1))}
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs text-muted">max 10</span>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {install ? (
                  <a
                    href={`/app/marketplace/products/${productId}`}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                  >
                    Install
                  </a>
                ) : cartLine ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-primary bg-surface px-2 py-1.5">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      disabled={busy}
                      onClick={() => void bump(-1)}
                      className="grid h-8 w-8 place-items-center rounded-md text-sm font-bold hover:bg-[var(--hero-tint)] disabled:opacity-50"
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center text-sm font-bold tabular-nums">
                      {cartLine.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={busy || cartLine.quantity >= 10}
                      onClick={() => void bump(1)}
                      className="grid h-8 w-8 place-items-center rounded-md text-sm font-bold hover:bg-[var(--hero-tint)] disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void addToCart()}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    Add to Cart
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void addWishlist()}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
                >
                  Add to Wishlist
                </button>
              </div>
              {note && <p className="mt-2 text-xs text-muted">{note}</p>}
              {sku && <p className="mt-3 text-xs text-muted">SKU: {sku}</p>}
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="border-t border-border px-5 pb-5">
            <div className="flex gap-4 border-b border-border">
              {(
                [
                  ["description", "Description"],
                  ["reviews", `Reviews (${reviewCount})`],
                  ["shipping", "Shipping"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`border-b-2 px-1 py-3 text-sm font-semibold ${
                    tab === id
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="pt-4 text-sm text-muted">
              {tab === "description" && (
                <p>{description || "No description provided."}</p>
              )}
              {tab === "reviews" &&
                (reviews.length === 0 ? (
                  <p>No reviews yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {reviews.map((r, i) => (
                      <li key={`${r.created_at}-${i}`} className="rounded-lg border border-border p-3">
                        <p className="font-semibold text-foreground">
                          {r.customer_name} · ★ {r.rating.toFixed(1)}
                        </p>
                        {r.comment ? <p className="mt-1">{r.comment}</p> : null}
                      </li>
                    ))}
                  </ul>
                ))}
              {tab === "shipping" && (
                <p>
                  {fulfilmentType === "SHIP_PHYSICAL"
                    ? "Ships to serviceable pincodes listed by the vendor. Delivery timelines depend on your address."
                    : "Digital / provisioned fulfilment — no physical shipping. Access is granted after purchase or install."}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
