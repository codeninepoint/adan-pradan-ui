"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { gstAmount } from "@/components/marketplace/commerce-money";
import { ApiError, marketplaceApi, type OrderDetail } from "@/lib/api";
import { formatMoney } from "@/lib/money";

const STATUS_BADGE: Record<string, string> = {
  placed: "bg-primary/15 text-primary",
  confirmed: "bg-primary/15 text-primary",
  processing: "bg-warning/15 text-warning",
  partial: "bg-warning/15 text-warning",
  delayed: "bg-warning/15 text-warning",
  delivered: "bg-success/15 text-success",
  cancelled: "bg-error/15 text-error",
};

function statusLabel(status: string): string {
  if (!status) return "";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function OrderDetailModal({
  orderId,
  onClose,
  onUpdated,
}: {
  orderId: string;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const { tenantId, ensureAccessToken } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [returnLineId, setReturnLineId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void marketplaceApi
      .order(orderId, ensureAccessToken)
      .then((detail) => {
        if (!cancelled) setOrder(detail);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.detail : "Could not load order.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, ensureAccessToken]);

  const subtotal =
    order?.lines.reduce((sum, line) => sum + line.unit_price * line.quantity, 0) ?? 0;
  const gst = gstAmount(subtotal);
  const total = Math.round((subtotal + gst) * 100) / 100;
  const currency = order?.lines[0]?.currency || "INR";
  const canCancel =
    Boolean(order) &&
    (order?.vendors.length ?? 0) > 0 &&
    order!.vendors.every((v) => v.status === "placed");

  async function cancelOrder() {
    if (!tenantId || !order || busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const updated = await marketplaceApi.cancelOrder(tenantId, order.order_id, ensureAccessToken);
      setOrder(updated);
      setNote("Order cancelled. Refunds are pending for each vendor slice.");
      onUpdated?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not cancel order.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReturn() {
    if (!order || !returnLineId || !returnReason.trim() || busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await marketplaceApi.requestReturn(
        order.order_id,
        { line_id: returnLineId, reason: returnReason.trim() },
        ensureAccessToken,
      );
      setNote("Return requested.");
      setReturnLineId(null);
      setReturnReason("");
      onUpdated?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not request return.");
    } finally {
      setBusy(false);
    }
  }

  function printInvoice() {
    window.print();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Order details"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">
              Order{" "}
              <span className="font-mono text-primary">
                {order ? shortId(order.order_id) : "…"}
              </span>
            </h2>
            {order && (
              <p className="mt-1 text-xs text-muted">
                {formatWhen(order.placed_at)} · {order.payment_method}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-2 py-1 text-sm text-muted"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && <p className="px-5 pt-4 text-sm text-error">{error}</p>}
        {note && <p className="px-5 pt-4 text-sm text-primary">{note}</p>}
        {!order && !error && <p className="p-5 text-sm text-muted">Loading order…</p>}

        {order && (
          <div className="grid gap-6 p-5 md:grid-cols-[1fr_1.1fr]">
            <div className="space-y-4">
              <section className="rounded-xl border border-border p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Status</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold capitalize ${
                      STATUS_BADGE[order.status] ?? "bg-background text-muted"
                    }`}
                  >
                    {statusLabel(order.status)}
                  </span>
                  <span className="text-success">Paid ✓</span>
                </div>
                {order.address && (
                  <p className="mt-3 text-muted">
                    {order.address.line1}, {order.address.city}
                    {order.address.pincode ? ` - ${order.address.pincode}` : ""}
                  </p>
                )}
              </section>

              <section className="rounded-xl border border-border p-4 text-sm">
                <h3 className="font-semibold">Price breakdown</h3>
                <dl className="mt-2 space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-muted">Subtotal</dt>
                    <dd>{formatMoney(subtotal, currency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">GST (18%)</dt>
                    <dd>{formatMoney(gst, currency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Shipping</dt>
                    <dd className="text-success">FREE</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 font-bold">
                    <dt>Total Paid</dt>
                    <dd className="text-success">{formatMoney(total, currency)}</dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-xl border border-border p-4 text-sm">
                <h3 className="font-semibold">Order timeline</h3>
                <ol className="mt-3 space-y-3">
                  {(order.timeline?.length
                    ? order.timeline
                    : [
                        { label: "Order Placed", at: order.placed_at, done: true },
                        { label: "Payment Confirmed", at: order.placed_at, done: true },
                      ]
                  ).map((step) => (
                    <li key={step.label} className="flex gap-3">
                      <span
                        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                          step.done ? "bg-success" : "border border-primary"
                        }`}
                      />
                      <div>
                        <p className="font-semibold">{step.label}</p>
                        {step.at ? (
                          <p className="text-xs text-muted">{formatWhen(step.at)}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
                Vendor suborders
              </h3>
              {(order.vendors?.length ? order.vendors : []).map((vendor) => (
                <section
                  key={vendor.vendor_id}
                  className="rounded-xl border border-border p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{vendor.vendor_name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold capitalize ${
                        STATUS_BADGE[vendor.status] ?? "bg-background text-muted"
                      }`}
                    >
                      {statusLabel(vendor.status)}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {vendor.lines.map((line) => (
                      <li key={line.line_id} className="flex justify-between gap-2">
                        <span>
                          {line.product_name} × {line.quantity}
                        </span>
                        <span>
                          {formatMoney(line.unit_price * line.quantity, line.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {vendor.status === "delayed" && (
                    <p className="mt-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                      Fulfilment delayed — vendor is reconciling stock.
                    </p>
                  )}
                  {vendor.tracking_number && (
                    <p className="mt-2 rounded-lg bg-background px-3 py-2 text-xs text-muted">
                      {vendor.courier || "Courier"} · {vendor.tracking_number}
                    </p>
                  )}
                  {vendor.refund_status === "pending" && (
                    <p className="mt-2 text-xs text-warning">
                      Refund pending
                      {vendor.refund_amount != null
                        ? ` · ${formatMoney(vendor.refund_amount, currency)}`
                        : ""}
                    </p>
                  )}
                  {vendor.refund_status === "refunded" && (
                    <p className="mt-2 text-xs text-success">
                      Refunded
                      {vendor.refund_amount != null
                        ? ` · ${formatMoney(vendor.refund_amount, currency)}`
                        : ""}
                    </p>
                  )}
                  {vendor.status === "delivered" &&
                    vendor.lines.map((line) => (
                      <button
                        key={`return-${line.line_id}`}
                        type="button"
                        className="mt-2 mr-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
                        onClick={() => {
                          setReturnLineId(line.line_id);
                          setReturnReason("");
                        }}
                      >
                        Return {line.product_name}
                      </button>
                    ))}
                </section>
              ))}

              {returnLineId && (
                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm font-semibold">Return request</p>
                  <input
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Reason for return"
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busy || !returnReason.trim()}
                      onClick={() => void submitReturn()}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                    >
                      Submit return
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnLineId(null)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted">
                Cancellation available before fulfilment. After dispatch, return process applies.
              </p>
              <div className="flex flex-wrap gap-2">
                {canCancel && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void cancelOrder()}
                    className="rounded-lg bg-error px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Cancel Order
                  </button>
                )}
                <button
                  type="button"
                  onClick={printInvoice}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
                >
                  View Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setNote("Support ticket submitted (demo — no ticket backend).")}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
                >
                  Support Ticket
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function shortId(id: string): string {
  return id.length > 8 ? `ORD-${id.slice(0, 5).toUpperCase()}` : id;
}

function formatWhen(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
