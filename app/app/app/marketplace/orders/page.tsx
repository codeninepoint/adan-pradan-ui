"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { OrderDetailModal } from "@/components/marketplace/order-detail-modal";
import {
  ApiError,
  marketplaceApi,
  type CustomerHubOrder,
  type CustomerHubReturn,
  type CustomerOrderHub,
  type CustomerOrderHubChat,
  type CustomerOrderHubPayments,
  type OrderSummary,
} from "@/lib/api";
import { openCashfreeCheckout } from "@/lib/cashfree-checkout";
import { formatMoney } from "@/lib/money";

type View =
  | "home"
  | "return"
  | "return-submitted"
  | "refund-approved"
  | "chat"
  | "window-closed"
  | "payments";

const WINDOW_TOTAL = 1800;

const CAT_ICONS: Record<string, string> = {
  wrong_item: "❌",
  missing_item: "📦",
  quality: "🤢",
  quantity: "⚖",
  foreign_object: "⚠",
};

function inr(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(abs) ? 0 : 2,
  });
  return `${value < 0 ? "−" : ""}₹${formatted}`;
}

function formatCountdown(seconds: number) {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function statusPill(order: CustomerHubOrder) {
  if (order.status === "return_window") {
    return { label: "⏳ In Return Window", className: "bg-warning/15 text-warning" };
  }
  if (order.status === "return_submitted") {
    return { label: "⏳ Return pending", className: "bg-warning/15 text-warning" };
  }
  if (order.status === "refunded" || order.meta?.badge === "refunded") {
    return { label: "✓ Refunded", className: "bg-success/15 text-success" };
  }
  if (order.status === "window_closed" || order.meta?.badge === "complete") {
    return { label: "✓ Complete", className: "bg-success/15 text-success" };
  }
  return { label: order.status, className: "bg-muted/30 text-muted" };
}

function trackDot(state: string) {
  if (state === "done") return { cls: "bg-success/20 text-success", mark: "✓" };
  if (state === "active") return { cls: "bg-primary/20 text-primary ring-2 ring-primary/30", mark: "🕐" };
  return { cls: "bg-muted/30 text-muted", mark: "○" };
}

export default function OrdersPage() {
  const { tenantId, ensureAccessToken } = useAuth();
  const searchParams = useSearchParams();
  const [hub, setHub] = useState<CustomerOrderHub | null>(null);
  const [chat, setChat] = useState<CustomerOrderHubChat | null>(null);
  const [payments, setPayments] = useState<CustomerOrderHubPayments | null>(null);
  const [commerceOrders, setCommerceOrders] = useState<OrderSummary[]>([]);
  const [selectedCommerceId, setSelectedCommerceId] = useState<string | null>(null);
  const [view, setView] = useState<View>("home");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [refund, setRefund] = useState<CustomerHubReturn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [payBusyId, setPayBusyId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [category, setCategory] = useState("wrong_item");
  const [description, setDescription] = useState("");
  const [photoName, setPhotoName] = useState<string | null>(null);
  const closedRef = useRef(false);
  const paymentPollRef = useRef(false);

  useEffect(() => {
    const orderId =
      searchParams.get("order_id") || searchParams.get("paid") || null;
    const paymentReturn =
      searchParams.get("payment") === "return" || Boolean(searchParams.get("paid"));
    if (!tenantId || !orderId || !paymentReturn || paymentPollRef.current) return;
    paymentPollRef.current = true;
    let tries = 0;
    const poll = window.setInterval(() => {
      tries += 1;
      void marketplaceApi
        .orderPayment(tenantId, orderId, ensureAccessToken)
        .then((status) => {
          if (status.payment_status === "paid" || status.order_status === "placed") {
            window.clearInterval(poll);
            setToast("Payment confirmed");
            window.dispatchEvent(new Event("marketplace-cart"));
          } else if (
            status.payment_status === "failed" ||
            status.payment_status === "user_dropped"
          ) {
            window.clearInterval(poll);
            setError("Payment was not completed. You can retry checkout from the cart.");
          } else if (tries >= 12) {
            window.clearInterval(poll);
            setToast("Payment is still processing — refresh shortly.");
          }
        })
        .catch(() => {
          if (tries >= 12) window.clearInterval(poll);
        });
    }, 1500);
    return () => window.clearInterval(poll);
  }, [tenantId, ensureAccessToken, searchParams]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const [h, c, p, o] = await Promise.all([
      marketplaceApi.orderHub(tenantId, ensureAccessToken),
      marketplaceApi.orderHubChat(tenantId, ensureAccessToken),
      marketplaceApi.orderHubPayments(tenantId, ensureAccessToken),
      marketplaceApi.orders(tenantId, ensureAccessToken),
    ]);
    setHub(h);
    setChat(c);
    setPayments(p);
    setCommerceOrders(o.orders);
    const awaiting = o.orders.filter((row) => row.status === "awaiting_payment");
    await Promise.all(
      awaiting.slice(0, 5).map((row) =>
        marketplaceApi
          .reconcileOrderPayment(tenantId, row.order_id, ensureAccessToken)
          .catch(() => null),
      ),
    );
    if (awaiting.length > 0) {
      const refreshed = await marketplaceApi.orders(tenantId, ensureAccessToken);
      setCommerceOrders(refreshed.orders);
    }
    const active = h.active[0] ?? null;
    if (active && active.status === "return_window" && active.window_seconds != null) {
      setSecondsLeft((prev) => prev ?? active.window_seconds);
      setFocusId((id) => id ?? active.id);
    }
  }, [tenantId, ensureAccessToken]);

  async function resumePayment(orderId: string) {
    if (!tenantId) return;
    setPayBusyId(orderId);
    setError(null);
    try {
      const status = await marketplaceApi.reconcileOrderPayment(
        tenantId,
        orderId,
        ensureAccessToken,
      );
      if (status.payment_status === "paid" || status.order_status === "placed") {
        setToast("Payment confirmed");
        await load();
        return;
      }
      if (status.payment_session_id) {
        if (
          status.provider === "stub" ||
          !status.payment_session_id.startsWith("session_")
        ) {
          await marketplaceApi.simulateOrderPayment(tenantId, orderId, ensureAccessToken);
          setToast("Payment confirmed");
          await load();
          return;
        }
        await openCashfreeCheckout(status.payment_session_id, "sandbox");
        return;
      }
      setError("No payment session available — start checkout again from the cart.");
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : "Could not resume payment.");
    } finally {
      setPayBusyId(null);
    }
  }

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    void load()
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.detail : "Could not load orders."),
      )
      .finally(() => setLoading(false));
  }, [load, tenantId]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const focusOrder = useMemo(() => {
    if (!hub) return null;
    const all = [...hub.active, ...hub.past];
    if (focusId) return all.find((o) => o.id === focusId) ?? hub.active[0] ?? null;
    return hub.active[0] ?? null;
  }, [hub, focusId]);

  useEffect(() => {
    if (secondsLeft == null || view === "window-closed") return;
    if (secondsLeft <= 0) {
      if (!closedRef.current && focusOrder && focusOrder.status === "return_window" && tenantId) {
        closedRef.current = true;
        void marketplaceApi
          .orderHubCloseWindow(tenantId, focusOrder.id, ensureAccessToken)
          .then(async () => {
            await load();
            setView("window-closed");
          })
          .catch(() => setView("window-closed"));
      }
      return;
    }
    const t = window.setInterval(() => {
      setSecondsLeft((s) => (s == null ? s : Math.max(0, s - 1)));
    }, 1000);
    return () => window.clearInterval(t);
  }, [secondsLeft, view, focusOrder, tenantId, ensureAccessToken, load]);

  async function submitReturn() {
    if (!tenantId || !focusOrder) return;
    if (!photoName) {
      setToast("Please upload a photo first");
      return;
    }
    if (description.trim().length < 20) {
      setToast("Please describe the issue (min 20 chars)");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await marketplaceApi.orderHubSubmitReturn(
        tenantId,
        focusOrder.id,
        { category, description: description.trim(), photo_name: photoName },
        ensureAccessToken,
      );
      setRefund(result.item);
      await load();
      setView("return-submitted");
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : "Could not submit return.");
    } finally {
      setBusy(false);
    }
  }

  async function simulateAccept() {
    if (!tenantId || !focusOrder) return;
    setBusy(true);
    setError(null);
    try {
      const result = await marketplaceApi.orderHubSimulateAccept(
        tenantId,
        focusOrder.id,
        ensureAccessToken,
      );
      setRefund(result.item);
      setToast("Vendor responded!");
      await load();
      setView("refund-approved");
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : "Could not simulate accept.");
    } finally {
      setBusy(false);
    }
  }

  function openReturn(order: CustomerHubOrder) {
    setFocusId(order.id);
    if (order.status === "return_submitted") {
      setView("return-submitted");
      return;
    }
    if (order.status === "window_closed") {
      setView("window-closed");
      return;
    }
    if (order.status === "refunded") {
      setView("refund-approved");
      return;
    }
    setCategory("wrong_item");
    setDescription("");
    setPhotoName(null);
    if (order.window_seconds != null) setSecondsLeft(order.window_seconds);
    setView("return");
  }

  function openChat(order?: CustomerHubOrder) {
    if (order) setFocusId(order.id);
    setView("chat");
  }

  const progressPct =
    secondsLeft == null ? 0 : Math.round((Math.max(0, secondsLeft) / WINDOW_TOTAL) * 100);
  const timerUrgent = secondsLeft != null && secondsLeft < 300;
  const descLen = description.trim().length;

  if (loading) {
    return <p className="text-sm text-muted">Loading orders…</p>;
  }

  if (error && !hub) {
    return <p className="text-sm text-error">{error}</p>;
  }

  const thread =
    chat?.threads.find((t) => t.order_id === focusOrder?.id) ?? chat?.threads[0] ?? null;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted">{hub?.customer_name ?? "Customer"}</p>
        </div>
        <Link
          href="/app/marketplace"
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold"
        >
          + Shop More
        </Link>
      </div>

      {error && <p className="mb-3 text-sm text-error">{error}</p>}

      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-surface p-1 text-xs font-semibold">
        {(
          [
            ["home", "Orders"],
            ["chat", "Chat"],
            ["payments", "Payments"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`flex-1 rounded-lg px-3 py-2 ${
              view === id ||
              (id === "home" &&
                (view === "return" ||
                  view === "return-submitted" ||
                  view === "refund-approved" ||
                  view === "window-closed"))
                ? "bg-primary/15 text-primary"
                : "text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "home" && (
        <div className="mb-6 space-y-3">
          <p className="text-sm font-bold">Marketplace orders</p>
          {commerceOrders.length === 0 ? (
            <p className="text-sm text-muted">No marketplace orders yet.</p>
          ) : (
            <ul className="space-y-3">
              {commerceOrders.map((order) => (
                <li key={order.order_id}>
                  <div className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
                    <button
                      type="button"
                      onClick={() => setSelectedCommerceId(order.order_id)}
                      className="min-w-0 flex-1 text-left hover:opacity-90"
                    >
                      <p className="font-mono text-xs font-bold text-primary">
                        ORD-{order.order_id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {order.status} · {order.payment_method} ·{" "}
                        {formatWhen(order.placed_at)} · {order.line_count} item(s)
                      </p>
                      {(order.vendors ?? []).map((vendor) => (
                        <p key={vendor.vendor_id} className="text-xs">
                          <span className="font-semibold">{vendor.vendor_name}</span>
                          {": "}
                          <span className="capitalize text-muted">{vendor.status}</span>
                        </p>
                      ))}
                    </button>
                    <p className="font-bold text-success">
                      {formatMoney(order.total, "INR")}
                    </p>
                    {order.status === "awaiting_payment" && (
                      <button
                        type="button"
                        disabled={payBusyId === order.order_id}
                        onClick={() => void resumePayment(order.order_id)}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                      >
                        {payBusyId === order.order_id ? "Checking…" : "Complete payment"}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {view === "home" && hub && (
        <div className="space-y-4">
          <p className="text-sm font-bold">Demo food orders</p>
          <p className="text-sm font-bold">Active Orders</p>
          {hub.active.length === 0 ? (
            <p className="text-sm text-muted">No active orders.</p>
          ) : (
            hub.active.map((order) => {
              const pill = statusPill(order);
              return (
                <article
                  key={order.id}
                  className="overflow-hidden rounded-2xl border border-warning/40 bg-surface"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                    <div>
                      <p className="font-bold">Order {order.order_ref}</p>
                      <p className="text-xs text-muted">
                        {order.vendor_name} · {order.zone} · {order.placed_label}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pill.className}`}>
                      {pill.label}
                    </span>
                  </div>
                  {order.timeline.length > 0 && (
                    <ol className="space-y-0 px-4 py-4">
                      {order.timeline.map((step, idx) => {
                        const dot = trackDot(step.state);
                        const last = idx === order.timeline.length - 1;
                        return (
                          <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
                            {!last && (
                              <span
                                className={`absolute left-[10px] top-6 h-[calc(100%-8px)] w-0.5 ${
                                  step.state === "done" ? "bg-success/50" : "bg-border"
                                }`}
                              />
                            )}
                            <span
                              className={`relative z-[1] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] ${dot.cls}`}
                            >
                              {dot.mark}
                            </span>
                            <div>
                              <p
                                className={`text-[12.5px] font-semibold ${
                                  step.state === "active"
                                    ? "text-warning"
                                    : step.state === "pending"
                                      ? "text-muted"
                                      : ""
                                }`}
                              >
                                {step.title}
                              </p>
                              <p className="text-[11px] text-muted">{step.detail}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  <div className="flex gap-2 px-4 pb-4">
                    {order.status === "return_window" && (
                      <button
                        type="button"
                        className="flex-1 rounded-xl bg-error px-3 py-2.5 text-xs font-bold text-white"
                        onClick={() => openReturn(order)}
                      >
                        Raise a Return
                      </button>
                    )}
                    {order.status === "return_submitted" && (
                      <button
                        type="button"
                        className="flex-1 rounded-xl bg-warning/20 px-3 py-2.5 text-xs font-bold text-warning"
                        onClick={() => openReturn(order)}
                      >
                        View return status
                      </button>
                    )}
                    <button
                      type="button"
                      className="flex-1 rounded-xl border-2 border-border px-3 py-2.5 text-xs font-bold text-muted"
                      onClick={() => openChat(order)}
                    >
                      Chat with Vendor
                    </button>
                  </div>
                </article>
              );
            })
          )}

          <p className="pt-2 text-sm font-bold">Past Orders</p>
          {hub.past.length === 0 ? (
            <p className="text-sm text-muted">No past orders.</p>
          ) : (
            hub.past.map((order) => {
              const pill = statusPill(order);
              return (
                <article key={order.id} className="overflow-hidden rounded-2xl border border-border bg-surface">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div>
                      <p className="font-bold">Order {order.order_ref}</p>
                      <p className="text-xs text-muted">
                        {order.vendor_name} · {order.placed_label} · {inr(order.total)}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pill.className}`}>
                      {pill.label}
                    </span>
                  </div>
                  <p className="px-4 py-3 text-xs text-muted">{order.summary}</p>
                </article>
              );
            })
          )}
        </div>
      )}

      {view === "return" && focusOrder && (
        <div className="space-y-4">
          <button type="button" className="text-sm text-primary" onClick={() => setView("home")}>
            ← Back
          </button>
          <div
            className={`overflow-hidden rounded-2xl border ${
              timerUrgent ? "border-error/50" : "border-warning/50"
            } bg-surface`}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-warning">
                  Return Window
                </p>
                <p className="text-[11px] text-muted">
                  Order {focusOrder.order_ref} · closes at {focusOrder.window_closes_label}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p
                  className={`font-mono text-xl font-bold ${
                    timerUrgent ? "text-error" : "text-warning"
                  }`}
                >
                  {formatCountdown(secondsLeft ?? 0)}
                </p>
                <p className="text-[9px] text-muted">remaining</p>
              </div>
            </div>
            <div className="mx-4 mb-3 h-1.5 overflow-hidden rounded-full bg-muted/30">
              <div
                className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
                  timerUrgent ? "bg-error" : "bg-warning"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <p className="border-b border-border px-4 py-3 text-xs font-bold">
              Your Order — {focusOrder.order_ref}
            </p>
            <div className="px-4 py-2">
              {focusOrder.bill_lines.map((line) => (
                <div
                  key={line.label}
                  className={`flex justify-between border-b border-border py-2 text-[12.5px] last:border-0 ${
                    line.total ? "pt-3 text-[13.5px] font-bold" : ""
                  }`}
                >
                  <span>{line.label}</span>
                  <span className="font-mono">{inr(line.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-error/40 bg-surface p-4">
            <div>
              <p className="text-sm font-bold text-error">Raise a Return</p>
              <p className="text-[11px] text-muted">
                Select issue, upload photo, and describe. All fields required.
              </p>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">
                What went wrong?
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {(hub?.categories ?? []).map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCategory(cat.key)}
                    className={`rounded-lg border px-2.5 py-2 text-left text-[11.5px] font-medium ${
                      cat.key === "foreign_object" ? "col-span-2" : ""
                    } ${
                      category === cat.key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted"
                    }`}
                  >
                    {CAT_ICONS[cat.key] ?? ""} {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">
                Photo of the item <span className="text-error">*</span>
              </p>
              {!photoName ? (
                <button
                  type="button"
                  onClick={() =>
                    setPhotoName(`item_photo_${focusOrder.order_ref.replace("#", "")}.jpg`)
                  }
                  className="w-full rounded-[10px] border-2 border-dashed border-border px-4 py-5 text-center hover:border-primary"
                >
                  <p className="text-2xl">📷</p>
                  <p className="mt-1 text-xs font-semibold text-muted">Tap to take photo or upload</p>
                  <p className="mt-0.5 text-[10.5px] text-muted">
                    Mandatory — no photo = return not valid
                  </p>
                </button>
              ) : (
                <div className="flex items-center gap-3 rounded-[10px] border border-success/40 bg-success/10 px-3 py-3">
                  <span className="text-2xl">🖼</span>
                  <div>
                    <p className="text-xs font-semibold text-success">Photo uploaded ✓</p>
                    <p className="text-[10.5px] text-muted">{photoName} · 1.2 MB</p>
                  </div>
                  <button
                    type="button"
                    className="ml-auto text-error"
                    onClick={() => setPhotoName(null)}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">
                Describe the issue <span className="text-error">*</span>
              </p>
              <textarea
                className="min-h-[70px] w-full resize-y rounded-lg border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary"
                maxLength={300}
                placeholder="e.g. I ordered Masala Dosa but received plain Idli. The item is completely different."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p
                className={`mt-0.5 text-right text-[10px] ${
                  descLen >= 20 ? "text-success" : "text-error"
                }`}
              >
                {descLen >= 20
                  ? `${descLen} / 300`
                  : `${descLen} / 20 minimum (${Math.max(0, 20 - descLen)} more needed)`}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitReturn()}
              className="w-full rounded-xl bg-error px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? "Submitting…" : "Submit Return Request"}
            </button>
            <p className="text-center text-[10.5px] text-muted">
              Vendor has 5 minutes to respond. You&apos;ll be notified immediately.
            </p>
          </div>
        </div>
      )}

      {view === "return-submitted" && focusOrder && (
        <div className="space-y-4">
          <button type="button" className="text-sm text-primary" onClick={() => setView("home")}>
            ← Back
          </button>
          <div className="py-4 text-center">
            <p className="mb-3 text-5xl">📬</p>
            <p className="text-base font-bold">Return Request Submitted</p>
            <p className="mt-1 text-xs text-muted">
              Order {focusOrder.order_ref} · {inr(focusOrder.total)} at stake
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <p className="border-b border-border px-4 py-3 text-xs font-bold">What happens next</p>
            <div className="space-y-2.5 p-4 text-xs">
              <NextStep
                n={1}
                title="Vendor Notified"
                body={`${focusOrder.vendor_name} has 5 minutes to accept or contest your return.`}
              />
              <NextStep
                n={2}
                title="If Accepted"
                body={`Full refund of ${inr(focusOrder.total)} to your original payment method in 2–5 business days.`}
              />
              <NextStep
                n={3}
                title="If Contested"
                body="Platform admin reviews within 5 min. You'll get a notification."
              />
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-warning/50 bg-surface p-4">
            <span className="text-3xl">⏳</span>
            <div>
              <p className="text-[12.5px] font-bold text-warning">Waiting for vendor response</p>
              <p className="text-[11px] text-muted">Usually resolves in 2–5 minutes</p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void simulateAccept()}
            className="w-full rounded-xl border-2 border-border px-4 py-2.5 text-xs font-bold text-muted disabled:opacity-60"
          >
            [ Demo: Simulate Vendor Accepts ]
          </button>
        </div>
      )}

      {view === "refund-approved" && focusOrder && (
        <div className="space-y-4">
          <div className="py-4 text-center">
            <p className="mb-3 text-6xl">✅</p>
            <p className="text-lg font-bold text-success">Refund Approved!</p>
            <p className="mt-1 text-xs text-muted">
              Your return was accepted by {refund?.vendor_name ?? focusOrder.vendor_name}.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="border-b border-success/30 bg-success/10 px-4 py-3">
              <p className="text-xs font-bold text-success">Refund Details</p>
            </div>
            <div className="px-4 py-2 text-[12.5px]">
              <BillRow label="Order" value={focusOrder.order_ref} mono />
              <BillRow
                label="Refund amount"
                value={inr(refund?.refund_amount ?? focusOrder.total)}
                mono
                valueClass="text-success"
              />
              <BillRow label="To" value={refund?.refund_method ?? "UPI / original method"} />
              <BillRow label="Expected by" value={refund?.expected_by ?? "2–5 business days"} />
              <BillRow
                label="Refund reference"
                value={refund?.refund_reference ?? "—"}
                mono
                valueClass="text-[11px]"
              />
            </div>
          </div>
          <div className="rounded-[10px] border border-success/30 bg-success/10 px-3.5 py-3 text-xs text-success">
            ✓ Your complaint has been noted. Vendor has been informed. Thank you for helping us
            maintain quality.
          </div>
          <button
            type="button"
            onClick={() => setView("home")}
            className="w-full rounded-xl border-2 border-border px-4 py-2.5 text-sm font-bold text-muted"
          >
            Back to Orders
          </button>
        </div>
      )}

      {view === "chat" && (
        <div className="space-y-3">
          <p className="text-center text-[11px] text-muted">
            {chat?.info ?? "Messages go through AdanPradan. Your number is never shared."}
          </p>
          {!thread ? (
            <p className="text-sm text-muted">No chat threads yet.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-success/15 text-sm">
                  🏪
                </div>
                <div>
                  <p className="text-xs font-semibold">{thread.vendor_name}</p>
                  <p className="text-[10px] text-muted">Order {thread.order_ref}</p>
                </div>
                {thread.online && (
                  <span className="ml-auto rounded-lg bg-success/15 px-1.5 py-0.5 text-[9px] text-success">
                    Online
                  </span>
                )}
              </div>
              <div className="flex max-h-[260px] flex-col gap-2 overflow-y-auto p-3.5">
                {thread.messages.map((msg, i) => {
                  if (msg.kind === "system" || msg.kind === "alert") {
                    return (
                      <p
                        key={`${msg.text}-${i}`}
                        className={`text-center text-[10px] ${
                          msg.kind === "alert" ? "text-error" : "text-muted"
                        }`}
                      >
                        {msg.kind === "alert" ? `⚠ ${msg.text}` : msg.text}
                      </p>
                    );
                  }
                  const out = msg.kind === "customer";
                  return (
                    <div
                      key={`${msg.text}-${i}`}
                      className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        out
                          ? "ml-auto rounded-br-sm bg-primary/15"
                          : "rounded-bl-sm bg-background"
                      }`}
                    >
                      {msg.label && (
                        <p
                          className={`mb-0.5 text-[9px] font-bold ${
                            out ? "text-primary" : "text-success"
                          }`}
                        >
                          {msg.label}
                        </p>
                      )}
                      {msg.text}
                    </div>
                  );
                })}
              </div>
              <div
                className={`flex gap-2 border-t border-border p-2.5 ${
                  thread.locked ? "opacity-40" : ""
                }`}
              >
                <input
                  className="flex-1 rounded-full border border-border bg-background px-3.5 py-2 text-xs outline-none"
                  placeholder={thread.lock_label ?? "Type a message…"}
                  disabled={thread.locked}
                />
                <button
                  type="button"
                  disabled={thread.locked}
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-primary text-sm text-white disabled:opacity-50"
                >
                  ↑
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {view === "window-closed" && focusOrder && (
        <div className="space-y-4">
          <div className="py-5 text-center">
            <p className="mb-3 text-5xl">🔒</p>
            <p className="text-base font-bold">Return Window Closed</p>
            <p className="mt-1 text-xs text-muted">
              Order {focusOrder.order_ref} · Window expired at {focusOrder.window_closes_label}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3.5 text-[12.5px] leading-relaxed text-muted">
            The 30-minute return window for this food order has closed. Returns are only accepted
            within 30 minutes of delivery to ensure freshness and fairness.
            <br />
            <br />
            If you experienced a serious issue (foreign object, food safety concern), please contact
            our support team.
          </div>
          <button
            type="button"
            onClick={() => setView("home")}
            className="w-full rounded-xl border-2 border-border px-4 py-2.5 text-sm font-bold text-muted"
          >
            Back to Orders
          </button>
        </div>
      )}

      {view === "payments" && payments && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Kpi label="Paid" value={inr(payments.summary.orders_paid)} />
            <Kpi label="Refunds" value={inr(payments.summary.refunds)} />
            <Kpi label="Net" value={inr(payments.summary.net)} />
          </div>
          <ul className="space-y-2">
            {payments.items.map((item) => (
              <li
                key={`${item.order_ref}-${item.label}`}
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold">{item.order_ref}</p>
                  <p className="text-xs text-muted">
                    {item.vendor_name} · {item.label}
                  </p>
                </div>
                <p className="font-bold">{inr(item.amount)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedCommerceId && (
        <OrderDetailModal
          orderId={selectedCommerceId}
          onClose={() => setSelectedCommerceId(null)}
          onUpdated={() => void load()}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-success/20 px-4 py-2.5 text-xs font-semibold text-success shadow">
          {toast}
        </div>
      )}
    </div>
  );
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function NextStep({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex gap-2.5">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
        {n}
      </div>
      <div>
        <p className="text-[12.5px] font-semibold">{title}</p>
        <p className="text-[11px] text-muted">{body}</p>
      </div>
    </div>
  );
}

function BillRow({
  label,
  value,
  mono,
  valueClass = "",
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between border-b border-border py-2 last:border-0">
      <span className="text-muted">{label}</span>
      <span className={`${mono ? "font-mono" : ""} ${valueClass}`}>{value}</span>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}
