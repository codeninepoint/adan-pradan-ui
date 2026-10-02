"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { marketplaceApi, type CartLine } from "@/lib/api";

export default function CartPage() {
  const { tenantId, ensureAccessToken } = useAuth();
  const [lines, setLines] = useState<CartLine[]>([]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const cart = await marketplaceApi.cart(tenantId, ensureAccessToken);
    setLines(cart.lines);
  }, [tenantId, ensureAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = lines.reduce((sum, line) => sum + line.unit_price * line.quantity, 0);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Cart</h1>
      {lines.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Your cart is empty.</p>
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {lines.map((line) => (
              <li key={line.line_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
                <div>
                  <p className="font-semibold">{line.product_name}</p>
                  <p className="text-muted">
                    {line.plan_name} · ${line.unit_price} / {line.billing_period}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    defaultValue={line.quantity}
                    className="w-16 rounded-lg border border-border bg-background px-2 py-1"
                    onBlur={(event) => {
                      if (!tenantId) return;
                      const quantity = Number(event.target.value);
                      if (quantity >= 1 && quantity !== line.quantity) {
                        void marketplaceApi.updateCartLine(tenantId, line.line_id, quantity, ensureAccessToken).then(load);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="font-semibold text-primary"
                    onClick={() => {
                      if (!tenantId) return;
                      void marketplaceApi.removeCartLine(tenantId, line.line_id, ensureAccessToken).then(load);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm font-semibold">Total ${total.toFixed(2)}</p>
          <Link href="/app/marketplace/checkout" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
            Proceed to checkout
          </Link>
        </>
      )}
    </div>
  );
}
