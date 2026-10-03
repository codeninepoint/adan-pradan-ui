"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { FULFILMENT_CHIPS, fulfilmentLabel } from "@/components/marketplace/cards";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi } from "@/lib/api";

type Variant = { name: string; sku: string };

type ProductRow = {
  product_id: string;
  name: string;
  status: string;
  fulfilment_type: string;
  category: string;
  content: { variants?: Variant[] };
};

type OfferingRow = {
  offering_id: string;
  product_id: string;
  product_name: string;
  plan_name: string;
  status: string;
  price_usd: number;
};

type PluginRow = { plugin_id: string; name: string; slug: string };

type StockRow = {
  inventory_id: string;
  product_id: string;
  warehouse_id: string;
  warehouse_name: string;
  sku: string;
  available: number;
};

type Warehouse = { warehouse_id: string; name: string };

type VariantDraft = { name: string; sku: string; stock: string };

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const buttonClass =
  "cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const ghostClass = "cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

export default function VendorProductsPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [offerings, setOfferings] = useState<OfferingRow[]>([]);
  const [plugins, setPlugins] = useState<PluginRow[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [stockProduct, setStockProduct] = useState<ProductRow | null>(null);

  const load = useCallback(async () => {
    if (!vendor) return;
    const vendorId = vendor.vendor_id;
    const [productData, offeringData, pluginData, stockData, warehouseData] = await Promise.all([
      marketplaceApi.vendorProducts(vendorId, ensureAccessToken),
      marketplaceApi.offerings(vendorId, ensureAccessToken),
      marketplaceApi.plugins(vendorId, ensureAccessToken),
      marketplaceApi.vendorInventory(vendorId, ensureAccessToken),
      marketplaceApi.vendorWarehouses(vendorId, ensureAccessToken),
    ]);
    setProducts(productData.products);
    setOfferings(offeringData.offerings);
    setPlugins(pluginData.plugins);
    setStock(stockData.rows);
    setWarehouses(warehouseData.warehouses);
  }, [vendor, ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load products.");
    });
  }, [load]);

  async function run(key: string, action: () => Promise<string>) {
    setError(null);
    setMessage(null);
    setBusy(key);
    try {
      setMessage(await action());
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Request failed.");
    } finally {
      setBusy(null);
    }
  }

  if (!vendor) return null;

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted">
            Create a product with a fulfilment type, then publish its offering. Plugin registration stays on{" "}
            <Link href="/app/plugins" className="font-semibold text-primary hover:underline">
              Plugins
            </Link>
            .
          </p>
        </div>
        <button type="button" disabled={plugins.length === 0} className={buttonClass} onClick={() => setAdding(true)}>
          Add product
        </button>
      </div>
      {message && <p className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <ul className="mt-6 space-y-3">
        {products.length === 0 && <li className="text-sm text-muted">No products yet.</li>}
        {products.map((product) => {
          const offering = offerings.find((item) => item.product_id === product.product_id);
          const rows = displayRows(product, offering, stock);
          return (
            <li key={product.product_id} className="rounded-xl border border-border bg-surface p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{product.name}</p>
                  <p className="mt-1 text-muted">
                    {fulfilmentLabel(product.fulfilment_type)}
                    {product.category ? ` · ${product.category}` : ""} · {product.status}
                  </p>
                </div>
                <span className="text-xs font-semibold capitalize text-muted">{product.status}</span>
              </div>
              <table className="mt-3 w-full text-left text-xs">
                <thead className="text-muted">
                  <tr>
                    <th className="py-1 font-semibold">Variant</th>
                    <th className="py-1 font-semibold">SKU</th>
                    <th className="py-1 font-semibold">Price</th>
                    <th className="py-1 font-semibold">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.name}-${row.sku}`} className="border-t border-border">
                      <td className="py-2">{row.name}</td>
                      <td className="py-2 font-mono">{row.sku}</td>
                      <td className="py-2">{row.price}</td>
                      <td className="py-2">{row.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {product.status !== "archived" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={ghostClass} onClick={() => setEditing(product)}>
                    Edit
                  </button>
                  <button type="button" className={ghostClass} onClick={() => setStockProduct(product)}>
                    Manage stock
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    className={ghostClass}
                    onClick={() => {
                      void run(`archive-${product.product_id}`, async () => {
                        const archived = await marketplaceApi.archiveProduct(product.product_id, ensureAccessToken);
                        return `${product.name} is ${archived.status}.`;
                      });
                    }}
                  >
                    {busy === `archive-${product.product_id}` ? "Archiving…" : "Archive"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <section className="mt-8 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Offerings</h2>
        {offerings.length === 0 && <p className="mt-3 text-sm text-muted">No offerings yet.</p>}
        <ul className="mt-3 space-y-3">
          {offerings.map((offering) => (
            <li key={offering.offering_id} className="flex items-center justify-between gap-3 text-sm">
              <p>
                <span className="font-semibold">{offering.product_name}</span>
                <span className="text-muted">
                  {" "}
                  · {offering.plan_name} · ${offering.price_usd.toFixed(2)} · {offering.status}
                </span>
              </p>
              {offering.status !== "published" && (
                <button
                  type="button"
                  disabled={busy !== null}
                  className={buttonClass}
                  onClick={() => {
                    void run(`publish-${offering.offering_id}`, async () => {
                      const published = await marketplaceApi.publishOffering(offering.offering_id, ensureAccessToken);
                      return `${offering.product_name} is ${published.status}.`;
                    });
                  }}
                >
                  {busy === `publish-${offering.offering_id}` ? "Publishing…" : "Publish"}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {adding && (
        <AddProductDialog
          plugins={plugins}
          warehouses={warehouses}
          busy={busy === "create"}
          onClose={() => setAdding(false)}
          onSubmit={(payload) => {
            const vendorId = vendor.vendor_id;
            void run("create", async () => {
              const product = await marketplaceApi.createProduct(
                vendorId,
                {
                  name: payload.name,
                  description: payload.description,
                  plugin_id: payload.pluginId,
                  fulfilment_type: payload.fulfilmentType,
                  category: payload.category || undefined,
                  content: { variants: payload.variants.map(({ name, sku }) => ({ name, sku })) },
                },
                ensureAccessToken,
              );
              const offering = await marketplaceApi.createOffering(
                product.product_id,
                {
                  plan_name: payload.planName,
                  billing_period: payload.billingPeriod,
                  price_usd: payload.priceUsd,
                },
                ensureAccessToken,
              );
              if (payload.warehouseId) {
                for (const variant of payload.variants) {
                  const available = Number(variant.stock);
                  if (!variant.sku || !Number.isFinite(available) || available <= 0) continue;
                  await marketplaceApi.addInventory(
                    vendorId,
                    {
                      product_id: product.product_id,
                      warehouse_id: payload.warehouseId,
                      sku: variant.sku,
                      available,
                    },
                    ensureAccessToken,
                  );
                }
              }
              setAdding(false);
              return `${payload.name} is ${product.status}. Offering ${offering.status}.`;
            });
          }}
        />
      )}

      {editing && (
        <EditProductDialog
          product={editing}
          offering={offerings.find((item) => item.product_id === editing.product_id) ?? null}
          busy={busy === `edit-${editing.product_id}`}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => {
            const productId = editing.product_id;
            const offering = offerings.find((item) => item.product_id === productId);
            void run(`edit-${productId}`, async () => {
              const saved = await marketplaceApi.updateProduct(
                productId,
                {
                  name: payload.name,
                  category: payload.category,
                  content: { variants: payload.variants },
                },
                ensureAccessToken,
              );
              if (offering) {
                await marketplaceApi.updateOfferingPrice(offering.offering_id, payload.priceUsd, ensureAccessToken);
              }
              setEditing(null);
              return `${saved.name} saved.`;
            });
          }}
        />
      )}

      {stockProduct && (
        <ManageStockDialog
          key={stock
            .filter((row) => row.product_id === stockProduct.product_id)
            .map((row) => `${row.inventory_id}:${row.available}`)
            .join("|")}
          product={stockProduct}
          rows={stock.filter((row) => row.product_id === stockProduct.product_id)}
          warehouses={warehouses}
          busy={busy}
          onClose={() => setStockProduct(null)}
          onAdjust={(inventoryId, available) => {
            const vendorId = vendor.vendor_id;
            void run(`adjust-${inventoryId}`, async () => {
              await marketplaceApi.adjustInventory(vendorId, inventoryId, available, ensureAccessToken);
              return "Stock updated.";
            });
          }}
          onAdd={(body) => {
            const vendorId = vendor.vendor_id;
            void run("add-stock", async () => {
              await marketplaceApi.addInventory(
                vendorId,
                { product_id: stockProduct.product_id, ...body },
                ensureAccessToken,
              );
              return "Stock recorded.";
            });
          }}
        />
      )}
    </div>
  );
}

function displayRows(product: ProductRow, offering: OfferingRow | undefined, stock: StockRow[]) {
  const stored = Array.isArray(product.content?.variants) ? product.content.variants : [];
  const variants = stored.length > 0 ? stored : [{ name: offering?.plan_name || "—", sku: "—" }];
  const price = offering ? `$${offering.price_usd.toFixed(2)}` : "—";
  return variants.map((variant) => ({
    name: variant.name || "—",
    sku: variant.sku || "—",
    price,
    stock: stockLabel(product.product_id, variant.sku, stock),
  }));
}

function stockLabel(productId: string, sku: string, stock: StockRow[]) {
  const matched =
    sku && sku !== "—"
      ? stock.filter((row) => row.product_id === productId && row.sku === sku)
      : stock.filter((row) => row.product_id === productId);
  if (matched.length === 0) return "—";
  return String(matched.reduce((sum, row) => sum + row.available, 0));
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

function AddProductDialog({
  plugins,
  warehouses,
  busy,
  onClose,
  onSubmit,
}: {
  plugins: PluginRow[];
  warehouses: Warehouse[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    description: string;
    pluginId: string;
    fulfilmentType: string;
    category: string;
    planName: string;
    billingPeriod: string;
    priceUsd: number;
    warehouseId: string;
    variants: VariantDraft[];
  }) => void;
}) {
  const [variants, setVariants] = useState<VariantDraft[]>([{ name: "", sku: "", stock: "" }]);
  const [formError, setFormError] = useState<string | null>(null);

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const cleaned = variants
      .map((row) => ({ name: row.name.trim(), sku: row.sku.trim(), stock: row.stock.trim() }))
      .filter((row) => row.name || row.sku);
    if (cleaned.length === 0) {
      setFormError("Add at least one variant name or SKU.");
      return;
    }
    const needsWarehouse = cleaned.some((row) => Number(row.stock) > 0);
    const warehouseId = String(data.get("warehouse_id") ?? "");
    if (needsWarehouse && !warehouseId) {
      setFormError("Choose a warehouse before recording starting stock.");
      return;
    }
    setFormError(null);
    onSubmit({
      name: String(data.get("name") ?? ""),
      description: String(data.get("description") ?? ""),
      pluginId: String(data.get("plugin_id") ?? ""),
      fulfilmentType: String(data.get("fulfilment_type") ?? ""),
      category: String(data.get("category") ?? ""),
      planName: String(data.get("plan_name") ?? "Pro"),
      billingPeriod: String(data.get("billing_period") ?? "monthly"),
      priceUsd: Number(data.get("price_usd") ?? 0),
      warehouseId,
      variants: cleaned,
    });
  }

  return (
    <Dialog title="Add product" onClose={onClose}>
      <form onSubmit={onCreate} className="space-y-3">
        {formError && <p className="text-sm text-error">{formError}</p>}
        <label className="block text-xs font-semibold text-muted">
          Name
          <input name="name" required className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-muted">
          Description
          <input name="description" className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-muted">
          Plugin
          <select name="plugin_id" required className={inputClass} defaultValue={plugins[0]?.plugin_id ?? ""}>
            {plugins.map((plugin) => (
              <option key={plugin.plugin_id} value={plugin.plugin_id}>
                {plugin.name} · {plugin.slug}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-muted">
          Fulfilment
          <select name="fulfilment_type" className={inputClass} defaultValue="PROVISION_SOFTWARE">
            {FULFILMENT_CHIPS.map((chip) => (
              <option key={chip.code} value={chip.code}>
                {chip.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-muted">
          Category
          <input name="category" placeholder="Defaults to the plugin category" className={inputClass} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-muted">
            Plan
            <input name="plan_name" defaultValue="Pro" className={inputClass} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Billing
            <input name="billing_period" defaultValue="monthly" className={inputClass} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Price USD
            <input name="price_usd" type="number" min="0" step="0.01" defaultValue={49} className={inputClass} />
          </label>
        </div>
        <fieldset>
          <legend className="text-xs font-semibold text-muted">Variants</legend>
          <ul className="mt-2 space-y-2">
            {variants.map((row, index) => (
              <li key={index} className="grid grid-cols-[1fr_1fr_5rem_auto] gap-2">
                <input
                  value={row.name}
                  placeholder="Variant"
                  onChange={(event) =>
                    setVariants((current) =>
                      current.map((item, itemIndex) => (itemIndex === index ? { ...item, name: event.target.value } : item)),
                    )
                  }
                  className={inputClass}
                />
                <input
                  value={row.sku}
                  placeholder="SKU"
                  onChange={(event) =>
                    setVariants((current) =>
                      current.map((item, itemIndex) => (itemIndex === index ? { ...item, sku: event.target.value } : item)),
                    )
                  }
                  className={inputClass}
                />
                <input
                  value={row.stock}
                  type="number"
                  min={0}
                  placeholder="Stock"
                  onChange={(event) =>
                    setVariants((current) =>
                      current.map((item, itemIndex) => (itemIndex === index ? { ...item, stock: event.target.value } : item)),
                    )
                  }
                  className={inputClass}
                />
                <button
                  type="button"
                  className={ghostClass}
                  onClick={() => setVariants((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={`${ghostClass} mt-2`}
            onClick={() => setVariants((current) => [...current, { name: "", sku: "", stock: "" }])}
          >
            Add variant
          </button>
        </fieldset>
        <label className="block text-xs font-semibold text-muted">
          Warehouse for starting stock
          <select name="warehouse_id" className={inputClass} defaultValue="">
            <option value="">No starting stock</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Creating…" : "Create draft"}
        </button>
      </form>
    </Dialog>
  );
}

function EditProductDialog({
  product,
  offering,
  busy,
  onClose,
  onSubmit,
}: {
  product: ProductRow;
  offering: OfferingRow | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; category: string; priceUsd: number; variants: Variant[] }) => void;
}) {
  const initial = Array.isArray(product.content?.variants) ? product.content.variants : [];
  const [variants, setVariants] = useState<Variant[]>(
    initial.length > 0 ? initial.map((row) => ({ name: row.name, sku: row.sku })) : [{ name: "", sku: "" }],
  );
  const [formError, setFormError] = useState<string | null>(null);

  function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const cleaned = variants.map((row) => ({ name: row.name.trim(), sku: row.sku.trim() })).filter((row) => row.name || row.sku);
    if (cleaned.length === 0) {
      setFormError("Add at least one variant name or SKU.");
      return;
    }
    setFormError(null);
    onSubmit({
      name: String(data.get("name") ?? ""),
      category: String(data.get("category") ?? ""),
      priceUsd: Number(data.get("price_usd") ?? 0),
      variants: cleaned,
    });
  }

  return (
    <Dialog title="Edit product" onClose={onClose}>
      <form onSubmit={onSave} className="space-y-3">
        {formError && <p className="text-sm text-error">{formError}</p>}
        <label className="block text-xs font-semibold text-muted">
          Name
          <input name="name" required defaultValue={product.name} className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-muted">
          Category
          <input name="category" defaultValue={product.category} className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-muted">
          Price USD
          <input
            name="price_usd"
            type="number"
            min="0"
            step="0.01"
            required={offering !== null}
            defaultValue={offering?.price_usd ?? 0}
            disabled={offering === null}
            className={inputClass}
          />
        </label>
        <fieldset>
          <legend className="text-xs font-semibold text-muted">Variants</legend>
          <ul className="mt-2 space-y-2">
            {variants.map((row, index) => (
              <li key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  value={row.name}
                  placeholder="Variant"
                  onChange={(event) =>
                    setVariants((current) =>
                      current.map((item, itemIndex) => (itemIndex === index ? { ...item, name: event.target.value } : item)),
                    )
                  }
                  className={inputClass}
                />
                <input
                  value={row.sku}
                  placeholder="SKU"
                  onChange={(event) =>
                    setVariants((current) =>
                      current.map((item, itemIndex) => (itemIndex === index ? { ...item, sku: event.target.value } : item)),
                    )
                  }
                  className={inputClass}
                />
                <button
                  type="button"
                  className={ghostClass}
                  onClick={() => setVariants((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={`${ghostClass} mt-2`}
            onClick={() => setVariants((current) => [...current, { name: "", sku: "" }])}
          >
            Add variant
          </button>
        </fieldset>
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </Dialog>
  );
}

function ManageStockDialog({
  product,
  rows,
  warehouses,
  busy,
  onClose,
  onAdjust,
  onAdd,
}: {
  product: ProductRow;
  rows: StockRow[];
  warehouses: Warehouse[];
  busy: string | null;
  onClose: () => void;
  onAdjust: (inventoryId: string, available: number) => void;
  onAdd: (body: { warehouse_id: string; sku: string; available: number }) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((row) => [row.inventory_id, String(row.available)])),
  );
  const knownSkus = (product.content?.variants ?? []).map((variant) => variant.sku).filter(Boolean);

  function onRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onAdd({
      warehouse_id: String(data.get("warehouse_id") ?? ""),
      sku: String(data.get("sku") ?? ""),
      available: Number(data.get("available") ?? 0),
    });
    event.currentTarget.reset();
  }

  return (
    <Dialog title={`Stock · ${product.name}`} onClose={onClose}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No stock recorded for this product.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.inventory_id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <span className="font-mono">{row.sku}</span>
                <span className="text-muted"> · {row.warehouse_name}</span>
              </span>
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={drafts[row.inventory_id] ?? ""}
                  onChange={(event) => setDrafts((current) => ({ ...current, [row.inventory_id]: event.target.value }))}
                  className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  disabled={busy !== null}
                  className={ghostClass}
                  onClick={() => onAdjust(row.inventory_id, Number(drafts[row.inventory_id] ?? 0))}
                >
                  {busy === `adjust-${row.inventory_id}` ? "Saving…" : "Adjust"}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {warehouses.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          <Link href="/app/vendor/warehouses" className="font-semibold text-primary hover:underline">
            Add a warehouse
          </Link>{" "}
          before recording stock.
        </p>
      ) : (
        <form onSubmit={onRecord} className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-semibold text-muted">
            Warehouse
            <select name="warehouse_id" required className={inputClass} defaultValue={warehouses[0]?.warehouse_id}>
              {warehouses.map((warehouse) => (
                <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            SKU
            <input name="sku" required list={`skus-${product.product_id}`} className={inputClass} />
            <datalist id={`skus-${product.product_id}`}>
              {knownSkus.map((sku) => (
                <option key={sku} value={sku} />
              ))}
            </datalist>
          </label>
          <label className="text-xs font-semibold text-muted">
            Available
            <input name="available" type="number" min={0} defaultValue={0} className={inputClass} />
          </label>
          <button type="submit" disabled={busy !== null} className={`${buttonClass} self-end`}>
            {busy === "add-stock" ? "Saving…" : "Record stock"}
          </button>
        </form>
      )}
    </Dialog>
  );
}
