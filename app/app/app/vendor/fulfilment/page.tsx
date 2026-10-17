"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  advanceToReadyToShip,
  groupVendorOrders,
  itemCountLabel,
  ordersInPipelineColumn,
  type PipelineColumnId,
  type VendorOrder,
  type VendorOrderLine,
} from "@/components/vendor/order-grouping";
import { PIPELINE_COLUMN_LABELS, pipelineStatusLabel } from "@/components/vendor/order-status";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi } from "@/lib/api";
import { formatMoney } from "@/lib/money";

const COURIERS = ["Delhivery", "Blue Dart", "DTDC", "Ekart", "Xpressbees", "India Post"];

const buttonClass =
  "cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const amberClass =
  "cursor-pointer rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-300";
const ghostClass =
  "cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";
const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

const COLUMNS: { id: PipelineColumnId; accent: string }[] = [
  { id: "to_pack", accent: "border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300" },
  { id: "packed", accent: "border-violet-500/30 bg-violet-500/5 text-violet-800 dark:text-violet-300" },
  { id: "in_transit", accent: "border-sky-500/30 bg-sky-500/5 text-sky-800 dark:text-sky-300" },
  { id: "ofd", accent: "border-orange-500/30 bg-orange-500/5 text-orange-800 dark:text-orange-300" },
];

export default function VendorFulfilmentPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [lines, setLines] = useState<VendorOrderLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dispatchOrder, setDispatchOrder] = useState<VendorOrder | null>(null);
  const [trackOrder, setTrackOrder] = useState<VendorOrder | null>(null);

  const load = useCallback(async () => {
    if (!vendor) return;
    const data = await marketplaceApi.vendorOrders(vendor.vendor_id, ensureAccessToken);
    setLines(data.lines);
  }, [vendor, ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load fulfilment.");
    });
  }, [load]);

  const orders = useMemo(() => groupVendorOrders(lines), [lines]);
  const toPack = useMemo(() => ordersInPipelineColumn(orders, "to_pack"), [orders]);
  const packed = useMemo(() => ordersInPipelineColumn(orders, "packed"), [orders]);
  const inTransit = useMemo(() => ordersInPipelineColumn(orders, "in_transit"), [orders]);
  const ofd = useMemo(() => ordersInPipelineColumn(orders, "ofd"), [orders]);
  const active = useMemo(
    () => [...toPack, ...packed, ...inTransit, ...ofd],
    [toPack, packed, inTransit, ofd],
  );

  const byColumn: Record<PipelineColumnId, VendorOrder[]> = {
    to_pack: toPack,
    packed,
    in_transit: inTransit,
    ofd,
  };

  async function run(key: string, action: () => Promise<void>) {
    if (!vendor) return;
    setBusy(key);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not update the order.");
    } finally {
      setBusy(null);
    }
  }

  async function advance(orderId: string, status: string, shipment?: { courier: string; tracking_number: string }) {
    if (!vendor) return;
    await marketplaceApi.advanceVendorOrder(
      vendor.vendor_id,
      orderId,
      { status, courier: shipment?.courier, tracking_number: shipment?.tracking_number },
      ensureAccessToken,
    );
  }

  function markPacked(order: VendorOrder) {
    void run(`pack-${order.order_id}`, async () => {
      await advanceToReadyToShip(order.status, (next) => advance(order.order_id, next));
    });
  }

  function markDelivered(order: VendorOrder) {
    void run(`deliver-${order.order_id}`, async () => {
      await advance(order.order_id, "delivered");
    });
  }

  if (!vendor) return null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fulfilment Pipeline</h1>
          <p className="mt-1 text-sm text-muted">
            Move orders through the dispatch lifecycle — pack, dispatch, confirm delivery.
          </p>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting packing" value={toPack.length} accent="text-amber-600 dark:text-amber-400" />
        <StatCard label="Packed · awaiting pickup" value={packed.length} accent="text-violet-600 dark:text-violet-400" />
        <StatCard label="In transit" value={inTransit.length} accent="text-sky-600 dark:text-sky-400" />
        <StatCard label="Out for delivery" value={ofd.length} accent="text-orange-600 dark:text-orange-400" />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((column) => (
          <section key={column.id} className="min-w-0">
            <div
              className={`mb-2 rounded-lg border px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider ${column.accent}`}
            >
              {PIPELINE_COLUMN_LABELS[column.id]} ({byColumn[column.id].length})
            </div>
            <div className="space-y-2">
              {column.id === "ofd" && byColumn.ofd.length === 0 && (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted">
                  Carrier out-for-delivery events and delivery OTP are not wired yet.
                </p>
              )}
              {byColumn[column.id].map((order) => (
                <OrderCard
                  key={order.order_id}
                  order={order}
                  column={column.id}
                  busy={busy !== null}
                  packing={busy === `pack-${order.order_id}`}
                  delivering={busy === `deliver-${order.order_id}`}
                  onPack={() => markPacked(order)}
                  onDispatch={() => setDispatchOrder(order)}
                  onTrack={() => setTrackOrder(order)}
                  onDeliver={() => markDelivered(order)}
                />
              ))}
              {column.id !== "ofd" && byColumn[column.id].length === 0 && (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted">
                  No orders
                </p>
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold">Active shipments</h2>
          <span className="text-xs text-muted">Use an action to advance the order status</span>
        </div>
        {active.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">No active shipments. Accept orders on the Orders page first.</p>
        ) : (
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Carrier</th>
                <th className="px-4 py-3">AWB / Tracking</th>
                <th className="px-4 py-3">ETA</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {active.map((order) => (
                <tr key={order.order_id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">
                    #{order.order_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">{order.customer_name}</td>
                  <td className="px-4 py-3 text-muted">{order.city || "—"}</td>
                  <td className="px-4 py-3 font-semibold">
                    {formatMoney(order.amount, order.currency || "INR")}
                  </td>
                  <td className="px-4 py-3 text-muted">{order.courier || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {order.tracking_number || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">—</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3">
                    <TableAction
                      order={order}
                      busy={busy !== null}
                      packing={busy === `pack-${order.order_id}`}
                      delivering={busy === `deliver-${order.order_id}`}
                      onPack={() => markPacked(order)}
                      onDispatch={() => setDispatchOrder(order)}
                      onTrack={() => setTrackOrder(order)}
                      onDeliver={() => markDelivered(order)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {dispatchOrder && (
        <DispatchModal
          order={dispatchOrder}
          busy={busy === `dispatch-${dispatchOrder.order_id}`}
          onClose={() => setDispatchOrder(null)}
          onSubmit={(courier, tracking_number) => {
            void run(`dispatch-${dispatchOrder.order_id}`, async () => {
              await advance(dispatchOrder.order_id, "shipped", { courier, tracking_number });
              setDispatchOrder(null);
            });
          }}
        />
      )}

      {trackOrder && (
        <TrackModal order={trackOrder} onClose={() => setTrackOrder(null)} />
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    processing: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    ready_to_ship: "border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-300",
    shipped: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        styles[status] ?? "border-border text-muted"
      }`}
    >
      {pipelineStatusLabel(status)}
    </span>
  );
}

function OrderCard({
  order,
  column,
  busy,
  packing,
  delivering,
  onPack,
  onDispatch,
  onTrack,
  onDeliver,
}: {
  order: VendorOrder;
  column: PipelineColumnId;
  busy: boolean;
  packing: boolean;
  delivering: boolean;
  onPack: () => void;
  onDispatch: () => void;
  onTrack: () => void;
  onDeliver: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
      <p className="font-mono text-xs font-extrabold">#{order.order_id.slice(0, 8)}</p>
      <p className="mt-1 text-xs text-muted">
        {order.customer_name} · {order.city || "—"}
      </p>
      <p className="mt-0.5 text-xs text-muted">
        {itemCountLabel(order.items)} ·{" "}
        <strong className="text-foreground">{formatMoney(order.amount, order.currency || "INR")}</strong>
      </p>
      {order.tracking_number && (
        <p className="mt-1 text-[10px] text-muted">
          {order.courier} · {order.tracking_number}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {column === "to_pack" && (
          <button type="button" disabled={busy} className={amberClass} onClick={onPack}>
            {packing ? "Packing…" : "Mark Packed"}
          </button>
        )}
        {column === "packed" && (
          <button type="button" disabled={busy} className={buttonClass} onClick={onDispatch}>
            Dispatch
          </button>
        )}
        {column === "in_transit" && (
          <>
            <button type="button" disabled={busy} className={ghostClass} onClick={onTrack}>
              Track
            </button>
            <button type="button" disabled={busy} className={buttonClass} onClick={onDeliver}>
              {delivering ? "Saving…" : "Mark delivered"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function TableAction({
  order,
  busy,
  packing,
  delivering,
  onPack,
  onDispatch,
  onTrack,
  onDeliver,
}: {
  order: VendorOrder;
  busy: boolean;
  packing: boolean;
  delivering: boolean;
  onPack: () => void;
  onDispatch: () => void;
  onTrack: () => void;
  onDeliver: () => void;
}) {
  if (order.status === "confirmed" || order.status === "processing") {
    return (
      <button type="button" disabled={busy} className={amberClass} onClick={onPack}>
        {packing ? "Packing…" : "Pack"}
      </button>
    );
  }
  if (order.status === "ready_to_ship") {
    return (
      <button type="button" disabled={busy} className={buttonClass} onClick={onDispatch}>
        Dispatch
      </button>
    );
  }
  if (order.status === "shipped") {
    return (
      <div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={busy} className={ghostClass} onClick={onTrack}>
          Track
        </button>
        <button type="button" disabled={busy} className={buttonClass} onClick={onDeliver}>
          {delivering ? "Saving…" : "Deliver"}
        </button>
      </div>
    );
  }
  return null;
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="my-8 w-full max-w-md rounded-xl border border-border bg-surface p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" className={ghostClass} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function DispatchModal({
  order,
  busy,
  onClose,
  onSubmit,
}: {
  order: VendorOrder;
  busy: boolean;
  onClose: () => void;
  onSubmit: (courier: string, tracking_number: string) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const courier = String(data.get("courier") ?? "").trim();
    const tracking_number = String(data.get("tracking_number") ?? "").trim();
    if (!courier || !tracking_number) {
      setFormError("Enter the courier and AWB / tracking number.");
      return;
    }
    setFormError(null);
    onSubmit(courier, tracking_number);
  }

  return (
    <Dialog title="Mark as Dispatched" onClose={onClose}>
      <p className="mb-4 text-sm text-muted">
        Order #{order.order_id.slice(0, 8)} · {order.customer_name} · {order.city || "—"} ·{" "}
        {formatMoney(order.amount, order.currency || "INR")}
      </p>
      <form onSubmit={onFormSubmit} className="space-y-3">
        {formError && <p className="text-sm text-error">{formError}</p>}
        <label className="block text-xs font-semibold text-muted">
          Courier partner
          <select name="courier" required defaultValue={COURIERS[0]} className={inputClass}>
            {COURIERS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-muted">
          AWB / Tracking number
          <input name="tracking_number" required placeholder="e.g. DV98234501" className={inputClass} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className={ghostClass} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? "Dispatching…" : "Confirm dispatch"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function TrackModal({ order, onClose }: { order: VendorOrder; onClose: () => void }) {
  return (
    <Dialog title="Shipment tracking" onClose={onClose}>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3 border-b border-border py-2">
          <dt className="text-muted">Order</dt>
          <dd className="font-mono font-semibold">#{order.order_id.slice(0, 8)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-border py-2">
          <dt className="text-muted">Courier</dt>
          <dd className="font-semibold">{order.courier || "—"}</dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-border py-2">
          <dt className="text-muted">AWB / Tracking</dt>
          <dd className="font-mono font-semibold">{order.tracking_number || "—"}</dd>
        </div>
        <div className="flex justify-between gap-3 py-2">
          <dt className="text-muted">Status</dt>
          <dd>
            <StatusBadge status={order.status} />
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted">Live carrier tracking is not connected yet.</p>
    </Dialog>
  );
}
