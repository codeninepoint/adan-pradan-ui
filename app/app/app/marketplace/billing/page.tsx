"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { marketplaceApi } from "@/lib/api";

type Sub = {
  offering_id: string;
  product_name: string;
  plan_name: string;
  status: string;
  next_billing_at: string | null;
};

export default function BillingPage() {
  const { tenantId, ensureAccessToken } = useAuth();
  const [items, setItems] = useState<Sub[]>([]);
  const [active, setActive] = useState(0);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const data = await marketplaceApi.subscriptions(tenantId, ensureAccessToken);
    setItems(data.subscriptions);
    setActive(data.active_count);
  }, [tenantId, ensureAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Subscriptions & billing</h1>
      <p className="mt-1 text-sm text-muted">{active} active. Invoices stay with a later billing integration.</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No recurring plans yet.</p>
      ) : (
        <ul className="mt-4 space-y-3 text-sm">
          {items.map((item) => (
            <li key={item.offering_id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
              <p>
                <span className="font-semibold">{item.product_name}</span>
                <span className="text-muted">
                  {" "}
                  · {item.plan_name} · {item.status}
                  {item.next_billing_at ? ` · next ${item.next_billing_at.slice(0, 10)}` : ""}
                </span>
              </p>
              {item.status === "active" && (
                <button
                  type="button"
                  className="font-semibold text-primary"
                  onClick={() => {
                    if (!tenantId) return;
                    void marketplaceApi.cancelSubscription(tenantId, item.offering_id, ensureAccessToken).then(load);
                  }}
                >
                  Cancel at period end
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
