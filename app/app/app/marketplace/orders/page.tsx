"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { OrderDetailModal } from "@/components/marketplace/order-detail-modal";
import { marketplaceApi, type OrderSummary } from "@/lib/api";
import { formatMoney } from "@/lib/money";

const STATUS_BADGE: Record<string, string> = {
  placed: "bg-primary/15 text-primary",
  confirmed: "bg-primary/15 text-primary",
  processing: "bg-warning/15 text-warning",
  partial: "bg-warning/15 text-warning",
  delivered: "bg-success/15 text-success",
  cancelled: "bg-muted/30 text-muted",
};

function statusLabel(status: string): string {
  if (!status) return "";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function vendorStatusClass(status: string): string {
  if (status === "delivered") return "text-success";
  if (status === "cancelled" || status === "rejected") return "text-error";
  if (status === "delayed" || status === "processing" || status === "partial") {
    return "text-warning";
  }
  return "text-primary";
}

export default function OrdersPage() {
  const { tenantId, ensureAccessToken } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  function load() {
    if (!tenantId) return;
    void marketplaceApi.orders(tenantId, ensureAccessToken).then((data) => setOrders(data.orders));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on tenant change
  }, [tenantId, ensureAccessToken]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">My Orders</h1>
        <Link
          href="/app/marketplace"
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold"
        >
          + Shop More
        </Link>
      </div>
      {orders.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No orders yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {orders.map((order) => (
            <li key={order.order_id}>
              <button
                type="button"
                onClick={() => setSelected(order.order_id)}
                className="flex w-full flex-wrap items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm hover:border-primary"
              >
                <div className="min-w-[140px]">
                  <p className="font-mono text-xs font-bold text-primary">
                    ORD-{order.order_id.slice(0, 5).toUpperCase()}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                      STATUS_BADGE[order.status] ?? "bg-background text-muted"
                    }`}
                  >
                    {statusLabel(order.status)}
                  </span>
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  {(order.vendors ?? []).map((vendor) => (
                    <p key={vendor.vendor_id} className="text-xs">
                      <span className="font-semibold">{vendor.vendor_name}</span>
                      {": "}
                      <span className={`capitalize ${vendorStatusClass(vendor.status)}`}>
                        {statusLabel(vendor.status)}
                      </span>
                    </p>
                  ))}
                  {(!order.vendors || order.vendors.length === 0) && (
                    <p className="text-xs text-muted">{order.line_count} item(s)</p>
                  )}
                </div>
                <p className="text-xs text-muted">{order.line_count} item(s)</p>
                <p className="text-xs text-muted">{formatWhen(order.placed_at)}</p>
                <p className="min-w-[80px] text-right font-bold text-success">
                  {formatMoney(order.total, "INR")}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <OrderDetailModal
          orderId={selected}
          onClose={() => setSelected(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
