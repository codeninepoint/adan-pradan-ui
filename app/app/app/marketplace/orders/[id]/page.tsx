"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, marketplaceApi, type OrderDetail } from "@/lib/api";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { ensureAccessToken } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void marketplaceApi.order(params.id, ensureAccessToken).then(setOrder);
  }, [params.id, ensureAccessToken]);

  if (!order) return <p className="text-sm text-muted">Loading order…</p>;

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-muted">
        <Link href="/app/marketplace/orders" className="text-primary">Orders</Link> · {order.order_id.slice(0, 8)}
      </p>
      <h1 className="mt-2 text-2xl font-bold capitalize">{order.status}</h1>
      <p className="mt-1 text-sm text-muted">Payment recorded as {order.payment_method}. Tracking is not available yet.</p>
      {message && <p className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      <ul className="mt-6 space-y-4">
        {order.lines.map((line) => (
          <li key={line.line_id} className="rounded-xl border border-border bg-surface p-4 text-sm">
            <p className="font-semibold">
              {line.product_name} × {line.quantity}
            </p>
            <p className="text-muted">
              {line.plan_name} · {line.fulfilment_type} · ${line.unit_price}
            </p>
            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void marketplaceApi
                  .requestReturn(order.order_id, { line_id: line.line_id, reason }, ensureAccessToken)
                  .then(() => {
                    setMessage(`Return requested for ${line.product_name}.`);
                    setReason("");
                  })
                  .catch((err: unknown) => {
                    setError(err instanceof ApiError ? err.detail : "Could not request a return.");
                  });
              }}
            >
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason for return"
                className="min-w-48 flex-1 rounded-lg border border-border bg-background px-3 py-2"
              />
              <button type="submit" disabled={!reason.trim()} className="rounded-lg border border-border px-3 py-2 font-semibold disabled:opacity-50">
                Request return
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
