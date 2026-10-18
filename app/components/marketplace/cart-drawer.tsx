"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  cartTotalWithGst,
  groupLinesByVendor,
} from "@/components/marketplace/commerce-money";
import { ApiError, marketplaceApi, type CartLine } from "@/lib/api";
import { formatMoney } from "@/lib/money";

export function CartDrawer({
  open,
  onClose,
  onCheckout,
}: {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}) {
  const { tenantId, ensureAccessToken } = useAuth();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const cart = await marketplaceApi.cart(tenantId, ensureAccessToken);
      setLines(cart.lines);
    } catch {
      setLines([]);
    }
  }, [tenantId, ensureAccessToken]);

  useEffect(() => {
    if (!open) return;
    void load();
    function onCart() {
      void load();
    }
    window.addEventListener("marketplace-cart", onCart);
    return () => window.removeEventListener("marketplace-cart", onCart);
  }, [open, load]);

  const groups = groupLinesByVendor(lines);
  const totals = cartTotalWithGst(lines);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  async function bump(line: CartLine, delta: number) {
    if (!tenantId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = line.quantity + delta;
      if (next < 1) {
        await marketplaceApi.removeCartLine(tenantId, line.line_id, ensureAccessToken);
      } else {
        await marketplaceApi.updateCartLine(
          tenantId,
          line.line_id,
          Math.min(10, next),
          ensureAccessToken,
        );
      }
      window.dispatchEvent(new Event("marketplace-cart"));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not update cart.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(line: CartLine) {
    if (!tenantId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await marketplaceApi.removeCartLine(tenantId, line.line_id, ensureAccessToken);
      window.dispatchEvent(new Event("marketplace-cart"));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not remove item.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose} role="presentation">
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-bold">Cart ({itemCount} item{itemCount === 1 ? "" : "s"})</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-2 py-1 text-sm text-muted"
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && <p className="mb-3 text-sm text-error">{error}</p>}
          {lines.length === 0 ? (
            <p className="text-sm text-muted">Your cart is empty.</p>
          ) : (
            <div className="space-y-5">
              {groups.map((group) => (
                <section key={group.vendor_id}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">
                    {group.vendor_name}
                  </p>
                  <ul className="space-y-3">
                    {group.lines.map((line) => (
                      <li
                        key={line.line_id}
                        className="rounded-xl border border-border bg-background p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{line.product_name}</p>
                            <p className="text-xs text-muted">
                              {formatMoney(line.unit_price, line.currency)}
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label="Remove item"
                            disabled={busy}
                            onClick={() => void remove(line)}
                            className="text-muted hover:text-error disabled:opacity-50"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center rounded-lg border border-border">
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              disabled={busy}
                              onClick={() => void bump(line, -1)}
                              className="px-3 py-1 text-sm font-bold disabled:opacity-50"
                            >
                              −
                            </button>
                            <span className="min-w-8 text-center text-sm font-semibold tabular-nums">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label="Increase quantity"
                              disabled={busy || line.quantity >= 10}
                              onClick={() => void bump(line, 1)}
                              className="px-3 py-1 text-sm font-bold disabled:opacity-50"
                            >
                              +
                            </button>
                          </div>
                          <p className="text-sm font-semibold">
                            {formatMoney(line.unit_price * line.quantity, line.currency)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div className="border-t border-border px-5 py-4">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd>{formatMoney(totals.subtotal, totals.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Tax (18% GST)</dt>
                <dd>{formatMoney(totals.gst, totals.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd className="text-success">FREE</dd>
              </div>
              <div className="flex justify-between pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd className="text-success">{formatMoney(totals.total, totals.currency)}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={onCheckout}
              className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
  );
}
