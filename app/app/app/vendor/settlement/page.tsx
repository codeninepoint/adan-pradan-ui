"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import {
  ApiError,
  marketplaceApi,
  type VendorSettlementBank,
  type VendorSettlementChat,
  type VendorSettlementEarnings,
  type VendorSettlementHistory,
  type VendorSettlementOrders,
  type VendorSettlementReturn,
  type VendorSettlementReturns,
} from "@/lib/api";

type Tab = "earnings" | "returns" | "orders" | "history" | "chat" | "bank";

function inr(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(abs) ? 0 : 2,
  });
  return `${value < 0 ? "−" : ""}₹${formatted}`;
}

function reasonLabel(code: string) {
  if (code === "wrong_item") return "Wrong Item";
  return code.replace(/_/g, " ");
}

function formatCountdown(seconds: number) {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function trackerStatus(status: string, settlementLabel: string) {
  if (status === "on_hold") return "🔴 Return — On Hold";
  if (status === "settled") return "✓ Settled · IMPS sent";
  if (status === "window_open") return "Delivered · Window open";
  return settlementLabel || status;
}

function returnResolvedCopy(item: VendorSettlementReturn) {
  if (item.status === "accepted") {
    return "✅ Accepted — customer will be refunded. Settlement adjusted. Thank you for resolving quickly.";
  }
  if (item.status === "timed_out") {
    return `⏰ Time expired — return auto-accepted. ${inr(item.amount_on_hold)} adjusted. Customer refunded.`;
  }
  if (item.status === "contested") {
    return (
      "⏳ Escalated to platform admin. Decision expected within 5 minutes. You will be notified." +
      (item.contest_reason ? ` Reason: “${item.contest_reason}”` : "")
    );
  }
  return item.status;
}

export default function VendorSettlementPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [tab, setTab] = useState<Tab>("earnings");
  const [earnings, setEarnings] = useState<VendorSettlementEarnings | null>(null);
  const [returns, setReturns] = useState<VendorSettlementReturns | null>(null);
  const [orders, setOrders] = useState<VendorSettlementOrders | null>(null);
  const [history, setHistory] = useState<VendorSettlementHistory | null>(null);
  const [chat, setChat] = useState<VendorSettlementChat | null>(null);
  const [bank, setBank] = useState<VendorSettlementBank | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [contestForId, setContestForId] = useState<string | null>(null);
  const [contestReason, setContestReason] = useState("");
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});
  const [editingBank, setEditingBank] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [branch, setBranch] = useState("");
  const timedOutRef = useRef<Set<string>>(new Set());
  const respondRef = useRef<
    (returnId: string, action: "accept" | "contest" | "timeout", reason?: string) => Promise<void>
  >(async () => undefined);

  const vendorId = vendor?.vendor_id;

  const load = useCallback(async () => {
    if (!vendorId) return;
    const [e, r, o, h, c, b] = await Promise.all([
      marketplaceApi.vendorSettlementEarnings(vendorId, ensureAccessToken),
      marketplaceApi.vendorSettlementReturns(vendorId, ensureAccessToken),
      marketplaceApi.vendorSettlementOrders(vendorId, ensureAccessToken),
      marketplaceApi.vendorSettlementHistory(vendorId, ensureAccessToken),
      marketplaceApi.vendorSettlementChat(vendorId, ensureAccessToken),
      marketplaceApi.vendorSettlementBank(vendorId, ensureAccessToken),
    ]);
    setEarnings(e);
    setReturns(r);
    setOrders(o);
    setHistory(h);
    setChat(c);
    setBank(b);
    setCountdowns((prev) => {
      const next: Record<string, number> = {};
      for (const item of r.items) {
        if (item.status === "open" && item.deadline_seconds != null) {
          next[item.id] = prev[item.id] ?? item.deadline_seconds;
        }
      }
      return next;
    });
  }, [vendorId, ensureAccessToken]);

  useEffect(() => {
    if (!vendorId) return;
    setLoading(true);
    void load()
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.detail : "Could not load settlement."),
      )
      .finally(() => setLoading(false));
  }, [load, vendorId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const respond = useCallback(
    async (returnId: string, action: "accept" | "contest" | "timeout", reason?: string) => {
      if (!vendorId) return;
      setBusyId(returnId);
      setError(null);
      try {
        const result = await marketplaceApi.respondVendorSettlementReturn(
          vendorId,
          returnId,
          { action, reason },
          ensureAccessToken,
        );
        setMessage(result.message);
        setToast(result.toast || result.message);
        setContestForId(null);
        setContestReason("");
        setCountdowns((prev) => {
          const next = { ...prev };
          delete next[returnId];
          return next;
        });
        await load();
      } catch (err: unknown) {
        if (action === "timeout") {
          timedOutRef.current.delete(returnId);
        }
        setError(err instanceof ApiError ? err.detail : "Could not respond to return.");
      } finally {
        setBusyId(null);
      }
    },
    [vendorId, ensureAccessToken, load],
  );

  respondRef.current = respond;

  useEffect(() => {
    const openIds = Object.keys(countdowns);
    if (openIds.length === 0) return;
    const timer = window.setInterval(() => {
      setCountdowns((prev) => {
        const next: Record<string, number> = {};
        for (const [id, seconds] of Object.entries(prev)) {
          const remaining = Math.max(0, seconds - 1);
          next[id] = remaining;
          if (remaining === 0 && !timedOutRef.current.has(id)) {
            timedOutRef.current.add(id);
            void respondRef.current(id, "timeout");
          }
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [Object.keys(countdowns).join("|")]);

  const tabs = useMemo(
    () =>
      [
        { id: "earnings" as const, label: "Live Earnings" },
        {
          id: "returns" as const,
          label: "Return Alert",
          badge: returns?.open_count || earnings?.open_return_alerts || 0,
        },
        { id: "orders" as const, label: "Orders" },
        { id: "history" as const, label: "Settlement History" },
        { id: "chat" as const, label: "Customer Chat" },
        { id: "bank" as const, label: "Bank Account" },
      ] as const,
    [returns?.open_count, earnings?.open_return_alerts],
  );

  async function onUpdateBank(event: FormEvent) {
    event.preventDefault();
    if (!vendorId) return;
    setBusyId("bank");
    setError(null);
    try {
      const result = await marketplaceApi.updateVendorSettlementBank(
        vendorId,
        {
          bank_name: bankName,
          account_number: accountNumber,
          ifsc,
          branch: branch || undefined,
        },
        ensureAccessToken,
      );
      setMessage(result.message);
      setBank(result);
      setEditingBank(false);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : "Could not update bank account.");
    } finally {
      setBusyId(null);
    }
  }

  if (!vendor) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted">Loading vendor…</p>
      </main>
    );
  }

  if (error && !earnings) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-sm text-error">{error}</p>
      </main>
    );
  }

  if (loading || !earnings) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted">Loading settlement…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Settlement</h1>
          <p className="mt-1 text-sm text-muted">
            {earnings.as_of} · {earnings.zone}
            {earnings.live ? (
              <span className="ml-2 inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                Live
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold ${
              tab === item.id
                ? "bg-primary text-primary-foreground"
                : item.id === "returns" && (item.badge ?? 0) > 0
                  ? "bg-red-500/10 text-red-600"
                  : "text-muted hover:text-foreground"
            }`}
          >
            {item.label}
            {"badge" in item && (item.badge ?? 0) > 0 ? (
              <span className="ml-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] text-white">
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {message ? (
        <p className="mt-3 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-700">{message}</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-emerald-900 px-4 py-2 text-xs font-semibold text-emerald-100 shadow-lg">
          {toast}
        </div>
      ) : null}

      {tab === "earnings" ? (
        <section className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi value={inr(earnings.kpis.settled_today)} label="Settled Today" sub={earnings.kpis.settled_today_sub} tone="green" />
            <Kpi value={inr(earnings.kpis.pending_window)} label="Pending Window" sub={earnings.kpis.pending_window_sub} tone="amber" />
            <Kpi value={inr(earnings.kpis.on_hold)} label="On Hold" sub={earnings.kpis.on_hold_sub} tone="red" />
            <Kpi
              value={`${earnings.kpis.next_transfer_minutes} min`}
              label="Next Transfer"
              sub={earnings.kpis.next_transfer_sub}
              tone="teal"
            />
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
              Money Tracker — Active Orders
            </h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Gross</th>
                    <th className="px-4 py-3">Your Net</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Window</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.tracker.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-4 py-3 font-mono">{row.order_ref}</td>
                      <td className="px-4 py-3">{row.items}</td>
                      <td className="px-4 py-3 font-mono">{inr(row.gross)}</td>
                      <td className="px-4 py-3 font-mono">{inr(row.net)}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={row.status} label={trackerStatus(row.status, row.settlement_label)} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{row.window_label || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">{earnings.calculation.title}</h2>
            <div className="mt-3 divide-y divide-border">
              {earnings.calculation.lines.map((line) => (
                <div key={line.label} className="flex items-center justify-between py-2 text-sm">
                  <span className={line.tone === "net" ? "font-semibold" : "text-muted"}>{line.label}</span>
                  <span
                    className={`font-mono ${
                      line.tone === "net"
                        ? "font-bold text-emerald-600"
                        : line.tone === "deduction"
                          ? "text-red-600"
                          : ""
                    }`}
                  >
                    {line.tone === "deduction" ? `− ${inr(Math.abs(line.amount))}` : inr(line.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "returns" && returns ? (
        <section className="mt-6 space-y-4">
          {returns.items.length === 0 ? (
            <p className="text-sm text-muted">No return alerts right now.</p>
          ) : null}
          {returns.items.map((item) => {
            const open = item.status === "open";
            const remaining = countdowns[item.id] ?? item.deadline_seconds ?? 0;
            const contestOpen = contestForId === item.id;
            const expired = open && remaining <= 0;
            return (
              <article
                key={item.id}
                className={`overflow-hidden rounded-xl border-2 ${
                  open && !expired
                    ? "border-red-600 bg-red-500/[0.04]"
                    : expired
                      ? "border-border bg-surface opacity-90"
                      : "border-border bg-surface"
                }`}
              >
                <header
                  className={`flex flex-wrap items-start gap-3 px-4 py-3 ${
                    open ? "bg-red-500/10" : "border-b border-border"
                  }`}
                >
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                      🔴 Return Request — Respond Now
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Order {item.order_ref} · {inr(item.amount_on_hold)} on hold · Customer:{" "}
                      {item.customer_name}
                    </p>
                  </div>
                  {open ? (
                    <div className="ml-auto text-right">
                      <p
                        className={`font-mono text-3xl font-bold ${
                          expired ? "text-muted" : remaining <= 60 ? "text-red-600" : "text-red-600"
                        }`}
                      >
                        {formatCountdown(remaining)}
                      </p>
                      <p className="text-[10px] uppercase text-muted">remaining</p>
                    </div>
                  ) : (
                    <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs font-semibold capitalize text-muted">
                      {item.status.replace(/_/g, " ")}
                    </span>
                  )}
                </header>

                <div className="grid gap-4 p-4 sm:grid-cols-[72px_1fr]">
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-background text-2xl">
                    🍽️
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      Customer&apos;s Complaint
                    </p>
                    <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm leading-relaxed text-red-700">
                      &ldquo;{item.complaint}&rdquo;
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-600">
                        {reasonLabel(item.reason_code)}
                      </span>
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600">
                        Refund requested: {inr(item.refund_requested)}
                      </span>
                    </div>
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted">Order Was</p>
                    <p className="mt-1 text-sm text-muted">{item.order_items}</p>
                    <p className="mt-1 text-xs text-muted">{item.timeline}</p>
                    {item.chat.length > 0 ? (
                      <button
                        type="button"
                        className="mt-2 text-xs font-semibold text-primary hover:underline"
                        onClick={() => setTab("chat")}
                      >
                        View in-app chat history →
                      </button>
                    ) : null}
                  </div>
                </div>

                {open && !expired ? (
                  <p className="bg-amber-500/10 px-4 py-2 text-xs text-amber-800">
                    ⚠ If you don&apos;t respond in time, the return will be <strong>auto-accepted</strong> and{" "}
                    {inr(item.amount_on_hold)} will be deducted.
                  </p>
                ) : null}

                {open && !expired && !contestOpen ? (
                  <div className="grid gap-2 border-t border-border p-4 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-left disabled:opacity-50"
                      onClick={() => void respond(item.id, "accept")}
                    >
                      <div className="text-lg">✅</div>
                      <div className="mt-1 text-sm font-bold">Yes, Our Mistake</div>
                      <div className="text-xs text-muted">Refund approved. Settlement adjusted.</div>
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-left disabled:opacity-50"
                      onClick={() => {
                        setContestForId(item.id);
                        setContestReason("");
                      }}
                    >
                      <div className="text-lg">❌</div>
                      <div className="mt-1 text-sm font-bold">Contest This</div>
                      <div className="text-xs text-muted">Escalates to platform admin.</div>
                    </button>
                  </div>
                ) : null}

                {open && !expired && contestOpen ? (
                  <form
                    className="space-y-3 border-t border-border p-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void respond(item.id, "contest", contestReason);
                    }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">
                      Your Reason for Contesting
                    </p>
                    <textarea
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      rows={4}
                      required
                      autoFocus
                      value={contestReason}
                      onChange={(e) => setContestReason(e.target.value)}
                      placeholder="Explain why the customer's claim is incorrect. Platform admin will review your reason alongside the customer's photo."
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
                        onClick={() => setContestForId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={busyId === item.id || !contestReason.trim()}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        Submit Contest →
                      </button>
                    </div>
                  </form>
                ) : null}

                {!open || expired ? (
                  <p
                    className={`border-t border-border px-4 py-3 text-center text-sm font-semibold ${
                      item.status === "accepted" || item.status === "timed_out"
                        ? "text-emerald-700"
                        : item.status === "contested"
                          ? "text-amber-700"
                          : "text-muted"
                    }`}
                  >
                    {expired && open
                      ? `⏰ Time expired — return auto-accepted. ${inr(item.amount_on_hold)} adjusted. Customer refunded.`
                      : returnResolvedCopy(item)}
                  </p>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}

      {tab === "orders" && orders ? (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Today&apos;s Orders</h2>
            <span className="text-xs text-muted">{orders.total} orders total</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Settlement</th>
                  <th className="px-4 py-3">Return</th>
                </tr>
              </thead>
              <tbody>
                {orders.items.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-3 font-mono">{row.order_ref}</td>
                    <td className="px-4 py-3">{row.order_time}</td>
                    <td className="px-4 py-3">{row.items}</td>
                    <td className="px-4 py-3 font-mono">{inr(row.gross)}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={row.status} label={row.settlement_label} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{row.return_label || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "history" && history ? (
        <section className="mt-6 rounded-xl border border-border bg-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Settlement History</h2>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-[10px] font-semibold"
              onClick={() => setMessage("PDF download queued for settlement history.")}
            >
              Download PDF
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 border-b border-border p-4 sm:grid-cols-5">
            <Summary label={`${history.summary.period} Gross`} value={inr(history.summary.gross)} />
            <Summary label="Total Deductions" value={inr(history.summary.total_deductions)} tone="red" />
            <Summary label="Net Received" value={inr(history.summary.net_received)} tone="green" />
            <Summary label="TDS Deducted" value={inr(history.summary.tds_deducted)} tone="amber" />
            <Summary label="Refund Adjustments" value={inr(history.summary.refund_adjustments)} tone="red" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-background text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Deductions</th>
                  <th className="px-4 py-3">Refund Adj.</th>
                  <th className="px-4 py-3">Net Paid</th>
                  <th className="px-4 py-3">UTR</th>
                </tr>
              </thead>
              <tbody>
                {history.items.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-3">{row.settle_date}</td>
                    <td className="px-4 py-3">{row.orders}</td>
                    <td className="px-4 py-3 font-mono">{inr(row.gross)}</td>
                    <td className="px-4 py-3 font-mono">{inr(row.deductions)}</td>
                    <td className="px-4 py-3 font-mono text-red-600">{inr(row.refund_adj)}</td>
                    <td className="px-4 py-3 font-mono text-emerald-600">{inr(row.net)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{row.utr ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="bg-background px-4 py-3 text-xs text-muted">
            TDS certificate (Form 16A) available for download quarterly · Next: {history.summary.form_16a_next}
          </p>
        </section>
      ) : null}

      {tab === "chat" && chat ? (
        <section className="mt-6 space-y-3">
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-800 dark:text-sky-200">
            ℹ {chat.info}
          </div>
          {chat.threads.map((thread) => (
            <div key={thread.id} className="overflow-hidden rounded-xl border border-border bg-surface">
              <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-background text-sm">
                  👤
                </div>
                <div>
                  <p className="text-sm font-semibold">{thread.customer_name}</p>
                  <p className="text-[10px] text-muted">Order {thread.order_ref} · Locked after return</p>
                </div>
                <span className="ml-auto text-[10px] font-bold text-red-600">{thread.lock_label}</span>
              </div>
              <div className="flex max-h-80 flex-col gap-2 overflow-y-auto p-4">
                {thread.messages.map((msg, index) => {
                  if (msg.kind === "system" || msg.kind === "alert") {
                    return (
                      <p
                        key={`${msg.kind}-${index}`}
                        className={`text-center text-[10px] ${
                          msg.kind === "alert" ? "text-red-600" : "text-muted"
                        }`}
                      >
                        {msg.kind === "alert" ? `⚠ ${msg.text}` : msg.text}
                      </p>
                    );
                  }
                  const mine = msg.kind === "vendor";
                  return (
                    <div
                      key={`${msg.kind}-${index}`}
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        mine ? "ml-auto bg-background" : "bg-sky-500/10"
                      }`}
                    >
                      <span
                        className={`mb-1 block text-[9px] font-bold ${
                          mine ? "text-emerald-600" : "text-sky-600"
                        }`}
                      >
                        {msg.label || msg.kind}
                      </span>
                      {msg.text}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 border-t border-border px-4 py-3 opacity-40">
                <input
                  disabled
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Chat locked during return review..."
                />
                <button type="button" disabled className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                  Send
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {tab === "bank" && bank ? (
        <section className="mt-6 rounded-xl border border-border bg-surface p-4 space-y-4">
          <h2 className="text-sm font-semibold">Bank Account — IMPS Settlement</h2>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-4">
            <div>
              <p className="text-[11px] text-muted">Primary Settlement Account</p>
              <p className="mt-1 text-base font-bold">{bank.bank_name}</p>
              <p className="mt-1 font-mono text-sm text-muted">{bank.account_mask}</p>
              <p className="mt-1 text-xs text-muted">
                IFSC: {bank.ifsc} · {bank.branch}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                bank.verified
                  ? "bg-emerald-500/15 text-emerald-600"
                  : "bg-amber-500/15 text-amber-600"
              }`}
            >
              {bank.verified ? "✓ Verified" : "Pending verification"}
            </span>
          </div>
          <p className="text-sm text-muted">{bank.note}</p>
          {!editingBank ? (
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
              onClick={() => {
                setEditingBank(true);
                setBankName(bank.bank_name);
                setIfsc(bank.ifsc);
                setBranch(bank.branch);
                setAccountNumber("");
              }}
            >
              Update Bank Account
            </button>
          ) : (
            <form className="space-y-3 rounded-xl border border-border bg-background p-4" onSubmit={onUpdateBank}>
              <label className="block text-xs font-semibold uppercase text-muted">
                Bank name
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  required
                />
              </label>
              <label className="block text-xs font-semibold uppercase text-muted">
                Account number
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  required
                />
              </label>
              <label className="block text-xs font-semibold uppercase text-muted">
                IFSC
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value)}
                  required
                />
              </label>
              <label className="block text-xs font-semibold uppercase text-muted">
                Branch
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
                  onClick={() => setEditingBank(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyId === "bank"}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </form>
          )}
        </section>
      ) : null}
    </main>
  );
}

function Kpi({
  value,
  label,
  sub,
  tone,
}: {
  value: string;
  label: string;
  sub?: string;
  tone: "green" | "amber" | "red" | "teal";
}) {
  const toneClass = {
    green: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
    teal: "text-teal-600",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className={`text-xl font-bold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs font-medium">{label}</p>
      {sub ? <p className="text-[11px] text-muted">{sub}</p> : null}
    </div>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "red" | "green" | "amber";
}) {
  const toneClass =
    tone === "red"
      ? "text-red-600"
      : tone === "green"
        ? "text-emerald-600"
        : tone === "amber"
          ? "text-amber-600"
          : "";
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 font-mono text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const className =
    status === "settled"
      ? "bg-emerald-500/15 text-emerald-600"
      : status === "on_hold" || status === "refunded"
        ? "bg-red-500/15 text-red-600"
        : "bg-amber-500/15 text-amber-600";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>{label}</span>
  );
}
