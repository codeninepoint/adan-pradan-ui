"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi } from "@/lib/api";

type Stock = {
  inventory_id: string;
  product_id: string;
  product_name: string;
  warehouse_name: string;
  sku: string;
  available: number;
  reserved: number;
};

type Product = {
  product_id: string;
  name: string;
  content: { variants?: { name: string; sku: string }[] };
};
type Warehouse = { warehouse_id: string; name: string };

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

function variantName(products: Product[], productId: string, sku: string) {
  const product = products.find((item) => item.product_id === productId);
  return product?.content?.variants?.find((variant) => variant.sku === sku)?.name ?? "";
}

export default function VendorInventoryPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [rows, setRows] = useState<Stock[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draftsRef = useRef<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vendor) return;
    const vendorId = vendor.vendor_id;
    const [stock, productData, warehouseData] = await Promise.all([
      marketplaceApi.vendorInventory(vendorId, ensureAccessToken),
      marketplaceApi.vendorProducts(vendorId, ensureAccessToken),
      marketplaceApi.vendorWarehouses(vendorId, ensureAccessToken),
    ]);
    setRows(stock.rows);
    const nextDrafts = Object.fromEntries(stock.rows.map((row) => [row.inventory_id, String(row.available)]));
    draftsRef.current = nextDrafts;
    setDrafts(nextDrafts);
    setProducts(productData.products);
    setWarehouses(warehouseData.warehouses);
  }, [vendor, ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load inventory.");
    });
  }, [load]);

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vendor) return;
    const data = new FormData(event.currentTarget);
    setBusy("add");
    setError(null);
    try {
      await marketplaceApi.addInventory(
        vendor.vendor_id,
        {
          product_id: String(data.get("product_id") ?? ""),
          warehouse_id: String(data.get("warehouse_id") ?? ""),
          sku: String(data.get("sku") ?? ""),
          available: Number(data.get("available") ?? 0),
        },
        ensureAccessToken,
      );
      event.currentTarget.reset();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not add stock.");
    } finally {
      setBusy(null);
    }
  }

  async function onAdjust(inventoryId: string) {
    if (!vendor) return;
    const available = Number(draftsRef.current[inventoryId]);
    if (!Number.isInteger(available) || available < 0) {
      setError("Enter a whole available quantity of zero or more.");
      return;
    }
    setBusy(inventoryId);
    setError(null);
    setSavedId(null);
    try {
      await marketplaceApi.adjustInventory(vendor.vendor_id, inventoryId, available, ensureAccessToken);
      setSavedId(inventoryId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not adjust stock.");
    } finally {
      setBusy(null);
    }
  }

  if (!vendor) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
      <p className="mt-1 text-sm text-muted">
        Stock you record by SKU and warehouse. Reserved stays at zero until a later checkout reservation exists.
      </p>
      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No stock recorded yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Variant / SKU</th>
                <th className="px-4 py-3 font-semibold">Warehouse</th>
                <th className="px-4 py-3 font-semibold">Available</th>
                <th className="px-4 py-3 font-semibold">Reserved</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const variant = variantName(products, row.product_id, row.sku);
                const available = Number(drafts[row.inventory_id] ?? row.available);
                const low = Number.isFinite(available) && available <= 5;
                return (
                  <tr key={row.inventory_id} className="border-t border-border">
                    <td className="px-4 py-3 font-semibold">{row.product_name}</td>
                    <td className="px-4 py-3">
                      {variant ? `${variant} ` : ""}
                      <span className="font-mono text-muted">{row.sku}</span>
                    </td>
                    <td className="px-4 py-3 text-muted">{row.warehouse_name}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        aria-label={`Available for ${row.sku}`}
                        value={drafts[row.inventory_id] ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          draftsRef.current = { ...draftsRef.current, [row.inventory_id]: value };
                          setDrafts((current) => ({ ...current, [row.inventory_id]: value }));
                          setSavedId(null);
                        }}
                        className={`w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm ${
                          low ? "text-error" : "text-foreground"
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3 text-muted">{row.reserved}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busy !== null}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => void onAdjust(row.inventory_id)}
                        className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
                      >
                        {busy === row.inventory_id ? "Saving…" : "Adjust"}
                      </button>
                      {savedId === row.inventory_id && <span className="text-xs font-semibold text-success">Saved</span>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <form onSubmit={(event) => void onAdd(event)} className="mt-6 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Record stock</h2>
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
          Warehouse
          <select name="warehouse_id" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Select a warehouse
            </option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                {warehouse.name}
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
        <button
          type="submit"
          disabled={busy !== null || products.length === 0 || warehouses.length === 0}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50 sm:col-span-2"
        >
          {busy === "add" ? "Saving…" : "Add stock"}
        </button>
      </form>
    </div>
  );
}
