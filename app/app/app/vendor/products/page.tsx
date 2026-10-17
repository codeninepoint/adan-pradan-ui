"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi, ServiceCityItem, VendorProductItem, vendorApi } from "@/lib/api";
import { formatMoney } from "@/lib/money";

const CATEGORIES = ["Dairy", "Fresh Produce", "Beverages", "Bakery", "Snacks", "Grains", "Other"];

const AUTH_CHECKS = [
  "The product name, description, and images accurately represent the actual product I am selling.",
  "I have the legal right to sell this product (licensed distributor, manufacturer, or authorised reseller).",
  "The listed price is the correct MRP and I will not charge customers more than this amount.",
  "I have not included misleading health claims, fake certifications, or counterfeit branding in any text or image.",
  "I understand that Platform Admin may reject or remove this listing if it violates the AdanPradan Vendor Policy.",
];

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const buttonClass =
  "cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const ghostClass =
  "cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

function paStatusBadge(status: string) {
  switch (status) {
    case "live":
      return "text-success";
    case "pending_review":
      return "text-primary";
    case "rejected":
      return "text-error";
    default:
      return "text-muted";
  }
}

function paStatusLabel(status: string) {
  switch (status) {
    case "live":
      return "Live";
    case "pending_review":
      return "Pending Review";
    case "rejected":
      return "Rejected";
    case "not_submitted":
      return "Not submitted";
    default:
      return status;
  }
}

function visibilityBadge(visibility: string) {
  switch (visibility) {
    case "visible":
      return "text-success";
    case "awaiting_pa":
      return "text-muted";
    default:
      return "text-error";
  }
}

function visibilityLabel(visibility: string) {
  switch (visibility) {
    case "visible":
      return "Visible";
    case "awaiting_pa":
      return "Awaiting PA";
    default:
      return "Hidden";
  }
}

function stockLabel(status: string) {
  switch (status) {
    case "low_stock":
      return { text: "Low", className: "text-error" };
    case "ok":
      return { text: "OK", className: "text-success" };
    default:
      return { text: status || "—", className: "text-muted" };
  }
}

function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className={`my-8 w-full rounded-xl border border-border bg-surface p-5 ${wide ? "max-w-2xl" : "max-w-lg"}`}
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

export default function VendorProductsPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [products, setProducts] = useState<VendorProductItem[]>([]);
  const [cities, setCities] = useState<ServiceCityItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<VendorProductItem | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [paFilter, setPaFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [showPlugins, setShowPlugins] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState("INR");

  const load = useCallback(async () => {
    if (!vendor) return;
    const vendorId = vendor.vendor_id;
    const [productData, cityData, settings] = await Promise.all([
      marketplaceApi.vendorProducts(vendorId, ensureAccessToken),
      marketplaceApi.serviceCities(vendorId, ensureAccessToken),
      vendorApi.settings(vendorId, ensureAccessToken),
    ]);
    setProducts(productData.products);
    setCities(cityData.cities);
    setDefaultCurrency(settings.default_currency || "INR");
  }, [vendor, ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load products.");
    });
  }, [load]);

  const physicalProducts = useMemo(
    () => products.filter((p) => p.fulfilment_type === "SHIP_PHYSICAL" || p.pa_status !== "not_submitted" || p.mrp_inr > 0),
    [products],
  );
  const pluginProducts = useMemo(
    () => products.filter((p) => !physicalProducts.some((pp) => pp.product_id === p.product_id)),
    [products, physicalProducts],
  );

  const rejectedCount = useMemo(
    () => physicalProducts.filter((p) => p.pa_status === "rejected").length,
    [physicalProducts],
  );

  const cityNames = useMemo(() => {
    const names = new Set<string>();
    for (const product of physicalProducts) {
      for (const city of product.cities) names.add(city);
    }
    for (const city of cities) names.add(city.city_name);
    return [...names].sort();
  }, [physicalProducts, cities]);

  const filtered = useMemo(() => {
    return physicalProducts.filter((product) => {
      if (search && !product.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter && product.category !== categoryFilter) return false;
      if (paFilter && product.pa_status !== paFilter) return false;
      if (cityFilter && !product.cities.includes(cityFilter)) return false;
      return true;
    });
  }, [physicalProducts, search, categoryFilter, paFilter, cityFilter]);

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
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted">
            Manage your product catalogue. All new listings are reviewed by Platform Admin before going live.
          </p>
        </div>
        <button type="button" className={buttonClass} onClick={() => { setEditing(null); setShowForm(true); }}>
          + New Product
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
        <strong>Content is reviewed before it goes live.</strong> Platform Admin checks all new product listings and
        images for authenticity, accuracy, and policy compliance. Typical review time: <strong>4–24 hours</strong>.
      </div>

      {rejectedCount > 0 && (
        <div className="mt-3 rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm text-foreground">
          <strong>{rejectedCount} product{rejectedCount === 1 ? "" : "s"} rejected by Platform Admin.</strong> Open
          each rejected listing to see the reason and resubmit with corrections.
        </div>
      )}

      {message && <p className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Search products…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-[12rem] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <select
          value={paFilter}
          onChange={(event) => setPaFilter(event.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All PA statuses</option>
          <option value="live">Live</option>
          <option value="pending_review">Pending Review</option>
          <option value="rejected">Rejected</option>
          <option value="not_submitted">Not submitted</option>
        </select>
        <select
          value={cityFilter}
          onChange={(event) => setCityFilter(event.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All cities</option>
          {cityNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Price</th>
              <th className="px-4 py-3 font-semibold">Images</th>
              <th className="px-4 py-3 font-semibold">Cities</th>
              <th className="px-4 py-3 font-semibold">Stock</th>
              <th className="px-4 py-3 font-semibold">PA Status</th>
              <th className="px-4 py-3 font-semibold">Visibility</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted">
                  No products match your filters.
                </td>
              </tr>
            )}
            {filtered.map((product) => {
              const stock = stockLabel(product.stock_status);
              return (
                <tr key={product.product_id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{product.name}</p>
                    {product.net_weight && <p className="text-xs text-muted">{product.net_weight}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted">{product.category || "—"}</td>
                  <td className="px-4 py-3">
                    {product.mrp_inr > 0
                      ? formatMoney(product.mrp_inr, product.currency || defaultCurrency)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {product.image_count > 0 ? (
                      <span className="text-muted">{product.image_count}</span>
                    ) : (
                      <span className="text-xs font-semibold text-error">No images</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {product.cities.length === 0 ? (
                      <span className="text-xs font-semibold text-error">No city</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {product.cities.map((city) => (
                          <span
                            key={city}
                            className="rounded-full border border-border px-1.5 py-0.5 text-xs font-semibold text-primary"
                          >
                            {city}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${stock.className}`}>{stock.text}</td>
                  <td className={`px-4 py-3 font-semibold ${paStatusBadge(product.pa_status)}`}>
                    {paStatusLabel(product.pa_status)}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${visibilityBadge(product.visibility)}`}>
                    {visibilityLabel(product.visibility)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className={ghostClass}
                      onClick={() => {
                        setEditing(product);
                        setShowForm(true);
                      }}
                    >
                      {product.pa_status === "rejected" ? "Edit & Resubmit" : "Edit"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pluginProducts.length > 0 && (
        <section className="mt-8 rounded-xl border border-border bg-surface">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold"
            onClick={() => setShowPlugins((current) => !current)}
          >
            <span>Software / plugin products ({pluginProducts.length})</span>
            <span className="text-muted">{showPlugins ? "▲" : "▼"}</span>
          </button>
          {showPlugins && (
            <div className="border-t border-border px-4 py-3 text-sm text-muted">
              <p>
                Plugin-based products are managed on{" "}
                <Link href="/app/plugins" className="font-semibold text-primary hover:underline">
                  Plugins
                </Link>
                .
              </p>
              <ul className="mt-2 space-y-1">
                {pluginProducts.map((product) => (
                  <li key={product.product_id}>
                    {product.name} · {product.status}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {showForm && (
        <ProductFormDialog
          product={editing}
          cities={cities}
          defaultCurrency={defaultCurrency}
          busy={busy === "submit"}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSubmit={(payload) => {
            void run("submit", async () => {
              const saved = await marketplaceApi.submitProductListing(vendor.vendor_id, payload, ensureAccessToken);
              setShowForm(false);
              setEditing(null);
              return `${saved.name} submitted for review.`;
            });
          }}
        />
      )}
    </div>
  );
}

type FormPayload = {
  product_id?: string;
  name: string;
  description: string;
  category: string;
  sku: string;
  mrp_inr: number;
  currency?: string;
  net_weight: string;
  brand: string;
  image_urls: string[];
  authenticity_attested: boolean;
  city_ids: string[];
  fulfilment_type?: "SHIP_PHYSICAL";
};

function ProductFormDialog({
  product,
  cities,
  defaultCurrency,
  busy,
  onClose,
  onSubmit,
}: {
  product: VendorProductItem | null;
  cities: ServiceCityItem[];
  defaultCurrency: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: FormPayload) => void;
}) {
  const listingCurrency = product?.currency || defaultCurrency || "INR";
  const isResubmit = product?.pa_status === "rejected";
  const cityNameToId = useMemo(
    () => Object.fromEntries(cities.map((city) => [city.city_name, city.city_id])),
    [cities],
  );
  const initialCityIds = useMemo(
    () => (product?.cities ?? []).map((name) => cityNameToId[name]).filter(Boolean),
    [product, cityNameToId],
  );

  const [imageUrls, setImageUrls] = useState<string[]>(() => {
    const urls = product?.image_urls ?? [];
    return urls.length >= 2 ? urls.slice(0, 5) : [...urls, "", ""].slice(0, Math.max(2, urls.length + 1));
  });
  const [checks, setChecks] = useState<boolean[]>(() => AUTH_CHECKS.map(() => Boolean(product)));
  const [selectedCities, setSelectedCities] = useState<Set<string>>(() => new Set(initialCityIds));
  const [formError, setFormError] = useState<string | null>(null);

  function toggleCity(cityId: string) {
    setSelectedCities((current) => {
      const next = new Set(current);
      if (next.has(cityId)) next.delete(cityId);
      else next.add(cityId);
      return next;
    });
  }

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const urls = imageUrls.map((url) => url.trim()).filter(Boolean);
    if (urls.length < 1 || urls.length > 5) {
      setFormError("Provide 1 to 5 image URLs.");
      return;
    }
    if (!checks.every(Boolean)) {
      setFormError("Confirm all authenticity checklist items.");
      return;
    }
    if (selectedCities.size === 0) {
      setFormError("Select at least one serviceable city.");
      return;
    }
    const mrp = Number(data.get("mrp_inr"));
    if (!Number.isFinite(mrp) || mrp <= 0) {
      setFormError("Enter a valid MRP greater than zero.");
      return;
    }
    setFormError(null);
    onSubmit({
      ...(product ? { product_id: product.product_id } : {}),
      name: String(data.get("name") ?? ""),
      description: String(data.get("description") ?? ""),
      category: String(data.get("category") ?? ""),
      sku: String(data.get("sku") ?? ""),
      mrp_inr: mrp,
      currency: listingCurrency,
      net_weight: String(data.get("net_weight") ?? ""),
      brand: String(data.get("brand") ?? ""),
      image_urls: urls,
      authenticity_attested: true,
      city_ids: [...selectedCities],
      fulfilment_type: "SHIP_PHYSICAL",
    });
  }

  return (
    <Dialog title={product ? (isResubmit ? "Edit & Resubmit" : "Edit product") : "Add new product"} onClose={onClose} wide>
      {isResubmit && product?.pa_reject_reason && (
        <div className="mb-4 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm">
          <strong>Rejection reason:</strong> {product.pa_reject_reason}
        </div>
      )}
      <form onSubmit={onFormSubmit} className="space-y-4">
        {formError && <p className="text-sm text-error">{formError}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-muted">
            Product name *
            <input name="name" required defaultValue={product?.name ?? ""} className={inputClass} />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Category *
            <select name="category" required defaultValue={product?.category || CATEGORIES[0]} className={inputClass}>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-muted">
            SKU / barcode
            <input name="sku" defaultValue={product?.sku ?? ""} className={inputClass} />
          </label>
          <label className="block text-xs font-semibold text-muted">
            MRP / Price ({listingCurrency}) *
            <input
              name="mrp_inr"
              type="number"
              min="0.01"
              step="0.01"
              required
              defaultValue={product?.mrp_inr || ""}
              className={inputClass}
            />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Net weight / volume
            <input name="net_weight" defaultValue={product?.net_weight ?? ""} placeholder="e.g. 500g" className={inputClass} />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Brand name
            <input name="brand" defaultValue={product?.brand ?? ""} className={inputClass} />
          </label>
        </div>
        <label className="block text-xs font-semibold text-muted">
          Description *
          <textarea
            name="description"
            required
            rows={3}
            defaultValue={product?.description ?? ""}
            className={inputClass}
          />
        </label>

        <fieldset>
          <legend className="text-xs font-semibold text-muted">Product images (2–5 URL inputs)</legend>
          <div className="mt-2 space-y-2">
            {imageUrls.map((url, index) => (
              <input
                key={index}
                value={url}
                placeholder={`Image URL ${index + 1}`}
                onChange={(event) =>
                  setImageUrls((current) => current.map((item, i) => (i === index ? event.target.value : item)))
                }
                className={inputClass}
              />
            ))}
          </div>
          {imageUrls.length < 5 && (
            <button
              type="button"
              className={`${ghostClass} mt-2`}
              onClick={() => setImageUrls((current) => [...current, ""])}
            >
              Add image URL
            </button>
          )}
        </fieldset>

        <fieldset>
          <legend className="text-xs font-semibold text-muted">Content authenticity checklist *</legend>
          <div className="mt-2 space-y-2 rounded-lg border border-border bg-background p-3 text-sm">
            {AUTH_CHECKS.map((text, index) => (
              <label key={index} className="flex cursor-pointer gap-2">
                <input
                  type="checkbox"
                  checked={checks[index]}
                  onChange={(event) =>
                    setChecks((current) => current.map((item, i) => (i === index ? event.target.checked : item)))
                  }
                  className="mt-0.5"
                />
                <span>{text}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-semibold text-muted">Serviceable cities *</legend>
          {cities.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              No cities configured.{" "}
              <Link href="/app/vendor/locations" className="font-semibold text-primary hover:underline">
                Add locations
              </Link>{" "}
              first.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {cities.map((city) => (
                <label
                  key={city.city_id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedCities.has(city.city_id)}
                    onChange={() => toggleCity(city.city_id)}
                  />
                  {city.city_name}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="flex gap-2">
          <button type="submit" disabled={busy || cities.length === 0} className={buttonClass}>
            {busy ? "Submitting…" : isResubmit ? "Save & Resubmit" : "Submit for Review"}
          </button>
          <button type="button" className={ghostClass} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  );
}
