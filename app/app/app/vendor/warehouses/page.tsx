"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi } from "@/lib/api";

type Warehouse = {
  warehouse_id: string;
  name: string;
  location: string;
  capacity: number;
  units_stored: number;
  sku_count: number;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const buttonClass =
  "cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const ghostClass = "cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

export default function VendorWarehousesPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [rows, setRows] = useState<Warehouse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);

  const load = useCallback(async () => {
    if (!vendor) return;
    const data = await marketplaceApi.vendorWarehouses(vendor.vendor_id, ensureAccessToken);
    setRows(data.warehouses);
  }, [vendor, ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load warehouses.");
    });
  }, [load]);

  async function save(body: { name: string; location: string; capacity: number }, warehouseId?: string) {
    if (!vendor) return;
    setBusy(true);
    setError(null);
    try {
      if (warehouseId) {
        await marketplaceApi.updateWarehouse(vendor.vendor_id, warehouseId, body, ensureAccessToken);
      } else {
        await marketplaceApi.createWarehouse(vendor.vendor_id, body, ensureAccessToken);
      }
      setAdding(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not save the warehouse.");
    } finally {
      setBusy(false);
    }
  }

  if (!vendor) return null;

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warehouses</h1>
          <p className="mt-1 text-sm text-muted">Where this vendor keeps stock. Capacity is the unit limit you set.</p>
        </div>
        <button type="button" className={buttonClass} onClick={() => setAdding(true)}>
          Add warehouse
        </button>
      </div>
      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      <ul className="mt-6 space-y-3">
        {rows.length === 0 && <li className="text-sm text-muted">No warehouses yet.</li>}
        {rows.map((row) => {
          const over = row.capacity > 0 && row.units_stored > row.capacity;
          return (
            <li key={row.warehouse_id} className="rounded-xl border border-border bg-surface p-4 text-sm">
              <p className="font-semibold">{row.name}</p>
              <p className="mt-1 text-muted">{row.location}</p>
              <table className="mt-3 w-full text-left text-xs">
                <thead className="text-muted">
                  <tr>
                    <th className="py-1 font-semibold">Capacity</th>
                    <th className="py-1 font-semibold">Units stored</th>
                    <th className="py-1 font-semibold">SKUs stored</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border">
                    <td className="py-2">{row.capacity > 0 ? row.capacity : "—"}</td>
                    <td className={`py-2 ${over ? "font-semibold text-error" : ""}`}>{row.units_stored}</td>
                    <td className="py-2">{row.sku_count}</td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-3">
                <button type="button" className={ghostClass} onClick={() => setEditing(row)}>
                  Edit
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {adding && (
        <WarehouseDialog
          title="Add warehouse"
          busy={busy}
          onClose={() => setAdding(false)}
          onSubmit={(body) => void save(body)}
        />
      )}
      {editing && (
        <WarehouseDialog
          title="Edit warehouse"
          warehouse={editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSubmit={(body) => void save(body, editing.warehouse_id)}
        />
      )}
    </div>
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

function WarehouseDialog({
  title,
  warehouse,
  busy,
  onClose,
  onSubmit,
}: {
  title: string;
  warehouse?: Warehouse;
  busy: boolean;
  onClose: () => void;
  onSubmit: (body: { name: string; location: string; capacity: number }) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const capacity = Number(data.get("capacity"));
    if (!Number.isInteger(capacity) || capacity < 0) {
      setFormError("Enter a whole capacity of zero or more.");
      return;
    }
    setFormError(null);
    onSubmit({
      name: String(data.get("name") ?? ""),
      location: String(data.get("location") ?? ""),
      capacity,
    });
  }

  return (
    <Dialog title={title} onClose={onClose}>
      <form onSubmit={onFormSubmit} className="space-y-3">
        {formError && <p className="text-sm text-error">{formError}</p>}
        <label className="block text-xs font-semibold text-muted">
          Name
          <input name="name" required defaultValue={warehouse?.name ?? ""} className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-muted">
          Location
          <input
            name="location"
            required
            defaultValue={warehouse?.location ?? ""}
            placeholder="City, region"
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-semibold text-muted">
          Capacity
          <input
            name="capacity"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={warehouse && warehouse.capacity > 0 ? warehouse.capacity : ""}
            placeholder="Units this warehouse can hold"
            className={inputClass}
          />
        </label>
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </Dialog>
  );
}
