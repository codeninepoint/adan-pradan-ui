"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import {
  ApiError,
  CityInventoryRowItem,
  marketplaceApi,
  ServiceCityItem,
  VendorProductItem,
} from "@/lib/api";

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const buttonClass =
  "cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const ghostClass =
  "cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

type Draft = { available: string; threshold: string };

function statusLabel(status: string) {
  switch (status) {
    case "low_stock":
      return { text: "Low stock", className: "text-error" };
    case "ok":
      return { text: "OK", className: "text-success" };
    default:
      return { text: status, className: "text-muted" };
  }
}

function exportCsv(rows: CityInventoryRowItem[]) {
  const header = ["Product", "City", "SKU", "In Stock", "Reserved", "Threshold", "Status"];
  const lines = rows.map((row) =>
    [
      row.product_name,
      row.city_name,
      row.sku,
      row.available,
      row.reserved,
      row.reorder_threshold,
      row.status,
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "inventory-by-city.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function VendorInventoryPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [rows, setRows] = useState<CityInventoryRowItem[]>([]);
  const [products, setProducts] = useState<VendorProductItem[]>([]);
  const [cities, setCities] = useState<ServiceCityItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const draftsRef = useRef<Record<string, Draft>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    if (!vendor) return;
    const vendorId = vendor.vendor_id;
    const [stock, productData, cityData] = await Promise.all([
      marketplaceApi.vendorInventory(vendorId, ensureAccessToken, "by_city"),
      marketplaceApi.vendorProducts(vendorId, ensureAccessToken),
      marketplaceApi.serviceCities(vendorId, ensureAccessToken),
    ]);
    setRows(stock.city_rows);
    const nextDrafts = Object.fromEntries(
      stock.city_rows.map((row) => [
        row.inventory_id,
        { available: String(row.available), threshold: String(row.reorder_threshold) },
      ]),
    );
    draftsRef.current = nextDrafts;
    setDrafts(nextDrafts);
    setProducts(productData.products.filter((p) => p.fulfilment_type === "SHIP_PHYSICAL" || p.mrp_inr > 0));
    setCities(cityData.cities);
  }, [vendor, ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load inventory.");
    });
  }, [load]);

  const lowStockCount = useMemo(() => rows.filter((row) => row.status === "low_stock").length, [rows]);

  async function onAdjust(inventoryId: string) {
    if (!vendor) return;
    const draft = draftsRef.current[inventoryId];
    const available = Number(draft?.available);
    const threshold = Number(draft?.threshold);
    if (!Number.isInteger(available) || available < 0) {
      setError("Enter a whole available quantity of zero or more.");
      return;
    }
    if (!Number.isInteger(threshold) || threshold < 0) {
      setError("Enter a whole reorder threshold of zero or more.");
      return;
    }
    setBusy(inventoryId);
    setError(null);
    setSavedId(null);
    try {
      await marketplaceApi.adjustInventory(
        vendor.vendor_id,
        inventoryId,
        available,
        ensureAccessToken,
        threshold,
      );
      setSavedId(inventoryId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not adjust stock.");
    } finally {
      setBusy(null);
    }
  }

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vendor) return;
    const data = new FormData(event.currentTarget);
    const cityId = String(data.get("city_id") ?? "");
    const city = cities.find((item) => item.city_id === cityId);
    if (!city) {
      setError("Select a valid city.");
      return;
    }
    setBusy("add");
    setError(null);
    try {
      await marketplaceApi.addInventory(
        vendor.vendor_id,
        {
          product_id: String(data.get("product_id") ?? ""),
          warehouse_id: city.warehouse_id,
          sku: String(data.get("sku") ?? ""),
          available: Number(data.get("available") ?? 0),
          reorder_threshold: Number(data.get("reorder_threshold") ?? 20),
        },
        ensureAccessToken,
      );
      event.currentTarget.reset();
      setShowAdd(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not add stock.");
    } finally {
      setBusy(null);
    }
  }

  if (!vendor) return null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="mt-1 text-sm text-muted">Stock levels per product per city.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={ghostClass} onClick={() => exportCsv(rows)}>
            Export CSV
          </button>
          <button type="button" className={buttonClass} onClick={() => setShowAdd(true)}>
            + Add stock
          </button>
        </div>
      </div>

      {lowStockCount > 0 && (
        <div className="mt-4 rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm text-foreground">
          {lowStockCount} product{lowStockCount === 1 ? "" : "s"} are <strong>below reorder threshold</strong>.
          Restock soon to avoid order failures.
        </div>
      )}

      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No stock recorded yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">City</th>
                <th className="px-4 py-3 font-semibold">In Stock</th>
                <th className="px-4 py-3 font-semibold">Reserved</th>
                <th className="px-4 py-3 font-semibold">Threshold</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const draft = drafts[row.inventory_id] ?? {
                  available: String(row.available),
                  threshold: String(row.reorder_threshold),
                };
                const status = statusLabel(row.status);
                return (
                  <tr key={row.inventory_id} className="border-t border-border">
                    <td className="px-4 py-3 font-semibold">{row.product_name}</td>
                    <td className="px-4 py-3 text-muted">{row.city_name}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        aria-label={`Available for ${row.product_name} in ${row.city_name}`}
                        value={draft.available}
                        onChange={(event) => {
                          const value = event.target.value;
                          const next = {
                            ...draftsRef.current[row.inventory_id],
                            available: value,
                          };
                          draftsRef.current = { ...draftsRef.current, [row.inventory_id]: next };
                          setDrafts((current) => ({ ...current, [row.inventory_id]: next }));
                          setSavedId(null);
                        }}
                        className={`w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm ${
                          row.status === "low_stock" ? "text-error" : "text-foreground"
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3 text-muted">{row.reserved}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        aria-label={`Threshold for ${row.product_name} in ${row.city_name}`}
                        value={draft.threshold}
                        onChange={(event) => {
                          const value = event.target.value;
                          const next = {
                            ...draftsRef.current[row.inventory_id],
                            threshold: value,
                          };
                          draftsRef.current = { ...draftsRef.current, [row.inventory_id]: next };
                          setDrafts((current) => ({ ...current, [row.inventory_id]: next }));
                          setSavedId(null);
                        }}
                        className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm"
                      />
                    </td>
                    <td className={`px-4 py-3 font-semibold ${status.className}`}>{status.text}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void onAdjust(row.inventory_id)}
                          className={ghostClass}
                        >
                          {busy === row.inventory_id ? "Saving…" : "Adjust"}
                        </button>
                        {savedId === row.inventory_id && (
                          <span className="text-xs font-semibold text-success">Saved</span>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          onClick={() => setShowAdd(false)}
        >
          <form
            onSubmit={(event) => void onAdd(event)}
            className="my-8 w-full max-w-lg rounded-xl border border-border bg-surface p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold">Add stock</h2>
              <button type="button" className={ghostClass} onClick={() => setShowAdd(false)}>
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="text-xs font-semibold text-muted">
                Product
                <select name="product_id" required className={inputClass} defaultValue="">
                  <option value="" disabled>
                    Select a product
                  </option>
                  {products.map((product) => (
                    <option key={product.product_id} value={product.product_id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-muted">
                City
                <select name="city_id" required className={inputClass} defaultValue="">
                  <option value="" disabled>
                    Select a city
                  </option>
                  {cities.map((city) => (
                    <option key={city.city_id} value={city.city_id}>
                      {city.city_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-muted">
                SKU
                <input name="sku" required className={inputClass} />
              </label>
              <label className="text-xs font-semibold text-muted">
                Available
                <input name="available" type="number" min={0} defaultValue={0} className={inputClass} />
              </label>
              <label className="text-xs font-semibold text-muted">
                Reorder threshold
                <input name="reorder_threshold" type="number" min={0} defaultValue={20} className={inputClass} />
              </label>
              <button
                type="submit"
                disabled={busy !== null || products.length === 0 || cities.length === 0}
                className={buttonClass}
              >
                {busy === "add" ? "Saving…" : "Add stock"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
