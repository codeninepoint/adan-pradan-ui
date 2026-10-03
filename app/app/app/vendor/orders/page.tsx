"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ORDER_STEPPER, orderStatusLabel } from "@/components/vendor/order-status";
import { ApiError, marketplaceApi } from "@/lib/api";

type VendorOrderLine = {
  order_id: string;
  line_id: string;
  product_name: string;
  quantity: number;
  total: number;
  status: string;
  placed_at: string;
  customer_name: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  courier: string;
  tracking_number: string;
};

type VendorOrder = VendorOrderLine & { items: VendorOrderLine[]; amount: number };

const buttonClass =
  "cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const ghostClass = "cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";
const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

export default function VendorOrdersPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [lines, setLines] = useState<VendorOrderLine[]>([]);
  const [status, setStatus] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<VendorOrder | null>(null);

  const load = useCallback(async () => {
    if (!vendor) return;
    const data = await marketplaceApi.vendorOrders(vendor.vendor_id, ensureAccessToken);
    setLines(data.lines);
  }, [vendor, ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load orders.");
    });
  }, [load]);

  if (!vendor) return null;

  const orders = groupOrders(lines);
  const statuses = [...new Set(orders.map((order) => order.status))];
  const visible = status === "all" ? orders : orders.filter((order) => order.status === status);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
      <p className="mt-1 text-sm text-muted">
        Orders for this vendor. Amounts are the stored USD price. Open an order to move it through fulfilment.
      </p>
      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <FilterChip label="All" count={orders.length} active={status === "all"} onClick={() => setStatus("all")} />
        {statuses.map((item) => (
          <FilterChip
            key={item}
            label={orderStatusLabel(item)}
            count={orders.filter((order) => order.status === item).length}
            active={status === item}
            onClick={() => setStatus(item)}
          />
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No orders in this view.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {visible.map((order) => (
                <tr key={order.order_id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs">{order.order_id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{order.customer_name}</td>
                  <td className="px-4 py-3 text-muted">{itemSummary(order.items)}</td>
                  <td className="px-4 py-3 font-semibold">${order.amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted">{formatWhen(order.placed_at)}</td>
                  <td className="px-4 py-3 text-xs font-semibold">{orderStatusLabel(order.status)}</td>
                  <td className="px-4 py-3">
                    <button type="button" className={ghostClass} onClick={() => setOpen(order)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && vendor && (
        <OrderDialog
          order={open}
          onClose={() => setOpen(null)}
          onAdvance={async (next, shipment) => {
            await marketplaceApi.advanceVendorOrder(
              vendor.vendor_id,
              open.order_id,
              { status: next, courier: shipment?.courier, tracking_number: shipment?.tracking },
              ensureAccessToken,
            );
            const data = await marketplaceApi.vendorOrders(vendor.vendor_id, ensureAccessToken);
            setLines(data.lines);
            const refreshed = groupOrders(data.lines).find((order) => order.order_id === open.order_id);
            setOpen(refreshed ?? null);
          }}
        />
      )}
    </div>
  );
}

function groupOrders(lines: VendorOrderLine[]): VendorOrder[] {
  const grouped = new Map<string, VendorOrder>();
  for (const line of lines) {
    const current = grouped.get(line.order_id);
    if (!current) {
      grouped.set(line.order_id, { ...line, items: [line], amount: line.total });
      continue;
    }
    current.items.push(line);
    current.amount += line.total;
  }
  return [...grouped.values()];
}

function itemSummary(items: VendorOrderLine[]) {
  return items.map((item) => `${item.product_name} ×${item.quantity}`).join(", ");
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold ${
        active ? "border-primary bg-[var(--hero-tint)] text-foreground" : "border-border bg-surface text-muted"
      }`}
    >
      {label} ({count})
    </button>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="my-8 w-full max-w-lg rounded-xl border border-border bg-surface p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-mono text-sm font-bold">{title}</h2>
          <button type="button" className={ghostClass} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function OrderDialog({
  order,
  onClose,
  onAdvance,
}: {
  order: VendorOrder;
  onClose: () => void;
  onAdvance: (status: string, shipment?: { courier: string; tracking: string }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const terminal = order.status === "cancelled" || order.status === "returned";
  const stepIndex = ORDER_STEPPER.indexOf(order.status);

  async function advance(status: string, shipment?: { courier: string; tracking: string }) {
    setBusy(true);
    setFormError(null);
    try {
      await onAdvance(status, shipment);
      setShipping(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.detail : "Could not update the order.");
    } finally {
      setBusy(false);
    }
  }

  function confirmShip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const courier = String(data.get("courier") ?? "").trim();
    const tracking = String(data.get("tracking_number") ?? "").trim();
    if (!courier || !tracking) {
      setFormError("Enter the courier and tracking number.");
      return;
    }
    void advance("shipped", { courier, tracking });
  }

  return (
    <Dialog title={order.order_id} onClose={onClose}>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3 border-b border-border py-2">
          <dt className="text-muted">Customer</dt>
          <dd className="text-right font-semibold">{order.customer_name}</dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-border py-2">
          <dt className="text-muted">Items</dt>
          <dd className="text-right">{itemSummary(order.items)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-border py-2">
          <dt className="text-muted">Amount</dt>
          <dd className="font-semibold">${order.amount.toFixed(2)}</dd>
        </div>
      </dl>
      {!terminal && stepIndex >= 0 && (
        <ol className="mt-4 grid grid-cols-6 gap-1 text-center text-[10px] font-semibold">
          {ORDER_STEPPER.map((step, index) => {
            const done = index < stepIndex;
            const current = index === stepIndex;
            return (
              <li key={step} className={done ? "text-success" : current ? "text-primary" : "text-muted"}>
                <span
                  className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${
                    done
                      ? "border-success bg-success/15"
                      : current
                        ? "border-primary bg-[var(--hero-tint)]"
                        : "border-border"
                  }`}
                >
                  {done ? "✓" : index + 1}
                </span>
                <span className="mt-1 block leading-tight">{orderStatusLabel(step)}</span>
              </li>
            );
          })}
        </ol>
      )}
      {order.line1 && (
        <div className="mt-4 text-sm">
          <p className="font-semibold">Shipping to</p>
          <p className="mt-1 text-muted">
            {order.line1}, {order.city}, {order.state} {order.pincode}
          </p>
          {order.phone && <p className="text-muted">{order.phone}</p>}
        </div>
      )}
      {order.tracking_number && (
        <p className="mt-4 rounded-lg border border-border bg-background px-3 py-2 text-sm">
          Tracking <span className="font-semibold">{order.tracking_number}</span>
          {order.courier ? ` via ${order.courier}` : ""}
        </p>
      )}
      {formError && <p className="mt-3 text-sm text-error">{formError}</p>}
      {shipping ? (
        <form onSubmit={confirmShip} className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-muted">
            Courier
            <input name="courier" required className={inputClass} />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Tracking number
            <input name="tracking_number" required className={inputClass} />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={ghostClass} onClick={() => setShipping(false)}>
              Back
            </button>
            <button type="submit" disabled={busy} className={buttonClass}>
              {busy ? "Saving…" : "Confirm shipment"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {order.status === "placed" && (
            <>
              <button type="button" disabled={busy} className={`${ghostClass} text-error`} onClick={() => void advance("cancelled")}>
                Reject
              </button>
              <button type="button" disabled={busy} className={buttonClass} onClick={() => void advance("confirmed")}>
                Accept order
              </button>
            </>
          )}
          {order.status === "confirmed" && (
            <button type="button" disabled={busy} className={buttonClass} onClick={() => void advance("processing")}>
              Start processing
            </button>
          )}
          {order.status === "processing" && (
            <button type="button" disabled={busy} className={buttonClass} onClick={() => void advance("ready_to_ship")}>
              Mark packed
            </button>
          )}
          {order.status === "ready_to_ship" && (
            <button type="button" disabled={busy} className={buttonClass} onClick={() => setShipping(true)}>
              Ship now
            </button>
          )}
          {order.status === "shipped" && (
            <button type="button" disabled={busy} className={buttonClass} onClick={() => void advance("delivered")}>
              Mark delivered
            </button>
          )}
        </div>
      )}
    </Dialog>
  );
}
