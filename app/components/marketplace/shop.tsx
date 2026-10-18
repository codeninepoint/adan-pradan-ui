"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { ProductGrid } from "@/components/marketplace/cards";
import { ProductDetailModal } from "@/components/marketplace/product-detail-modal";
import {
  marketplaceApi,
  type CatalogItem,
  type CatalogVendorFacet,
} from "@/lib/api";

export function MarketplaceShop() {
  const router = useRouter();
  const params = useSearchParams();
  const { tenantId, ensureAccessToken } = useAuth();

  const [query, setQuery] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "");
  const [sort, setSort] = useState(params.get("sort") ?? "newest");
  const [priceMin, setPriceMin] = useState(params.get("price_min") ?? "");
  const [priceMax, setPriceMax] = useState(params.get("price_max") ?? "");
  const [selectedVendors, setSelectedVendors] = useState<string[]>(
    (params.get("vendor_ids") ?? "").split(",").filter(Boolean),
  );
  const [pincode, setPincode] = useState(params.get("pincode") ?? "");
  const [filterByPincode, setFilterByPincode] = useState(Boolean(params.get("pincode")));
  const [inStockOnly, setInStockOnly] = useState(params.get("in_stock") === "true");
  const [physical, setPhysical] = useState(
    (params.get("fulfilment") ?? "").includes("physical") ||
      params.get("type") === "SHIP_PHYSICAL",
  );
  const [digital, setDigital] = useState(
    (params.get("fulfilment") ?? "").includes("digital"),
  );

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [vendors, setVendors] = useState<CatalogVendorFacet[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [viewProductId, setViewProductId] = useState<string | null>(null);
  const [heroQuery, setHeroQuery] = useState(params.get("q") ?? "");

  useEffect(() => {
    void marketplaceApi.home().then((data) => setCategories(data.categories));
  }, []);

  useEffect(() => {
    if (!tenantId || pincode) return;
    void marketplaceApi
      .addresses(tenantId, ensureAccessToken)
      .then((data) => {
        const first = data.addresses[0];
        if (first?.pincode) setPincode(first.pincode);
      })
      .catch(() => undefined);
  }, [tenantId, ensureAccessToken, pincode]);

  const fulfilmentParam = useMemo(() => {
    const parts: string[] = [];
    if (physical) parts.push("physical");
    if (digital) parts.push("digital");
    return parts.length === 1 || parts.length === 2 ? parts.join(",") : undefined;
  }, [physical, digital]);

  useEffect(() => {
    void marketplaceApi
      .catalog({
        q: query.trim() || undefined,
        category: category.trim() || undefined,
        sort,
        price_min: priceMin || undefined,
        price_max: priceMax || undefined,
        vendor_ids: selectedVendors.length ? selectedVendors.join(",") : undefined,
        pincode: filterByPincode && pincode.trim() ? pincode.trim() : undefined,
        in_stock: inStockOnly || undefined,
        fulfilment: fulfilmentParam,
      })
      .then((data) => {
        setItems(data.results);
        setVendors(data.facets?.vendors ?? []);
      });
  }, [
    query,
    category,
    sort,
    priceMin,
    priceMax,
    selectedVendors,
    filterByPincode,
    pincode,
    inStockOnly,
    fulfilmentParam,
  ]);

  function toggleVendor(id: string) {
    setSelectedVendors((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }

  function clearFilters() {
    setQuery("");
    setHeroQuery("");
    setCategory("");
    setSort("newest");
    setPriceMin("");
    setPriceMax("");
    setSelectedVendors([]);
    setFilterByPincode(false);
    setInStockOnly(false);
    setPhysical(false);
    setDigital(false);
    router.replace("/app/marketplace");
  }

  function onHeroSearch(e: FormEvent) {
    e.preventDefault();
    setQuery(heroQuery.trim());
  }

  return (
    <div>
      <div className="rounded-2xl border border-border bg-[var(--hero-tint)] px-6 py-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Discover amazing products from top vendors
        </h1>
        <p className="mt-2 text-sm text-muted">
          Secure payments · Verified sellers · Fast fulfilment
        </p>
        <form onSubmit={onHeroSearch} className="mt-5 flex max-w-xl gap-2">
          <input
            value={heroQuery}
            onChange={(e) => setHeroQuery(e.target.value)}
            placeholder="What are you looking for?"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Search
          </button>
        </form>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <Chip
          active={!category}
          label="All"
          onClick={() => setCategory("")}
        />
        {categories.map((cat) => (
          <Chip
            key={cat}
            active={category === cat}
            label={cat}
            onClick={() => setCategory(cat === category ? "" : cat)}
          />
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[240px_1fr]">
        <aside className="h-fit space-y-5 rounded-xl border border-border bg-surface p-4 text-sm sticky top-4">
          <section>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Price range
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
              <span className="text-muted">—</span>
              <input
                type="number"
                placeholder="Max"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
          </section>

          <section>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Vendor</p>
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {vendors.length === 0 ? (
                <p className="text-xs text-muted">No vendors in view</p>
              ) : (
                vendors.map((v) => (
                  <label key={v.vendor_id} className="flex items-center gap-2 text-muted">
                    <input
                      type="checkbox"
                      checked={selectedVendors.includes(v.vendor_id)}
                      onChange={() => toggleVendor(v.vendor_id)}
                    />
                    <span className="text-foreground">{v.name}</span>
                  </label>
                ))
              )}
            </div>
          </section>

          <section>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Your pincode
            </p>
            <input
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="e.g. 400001"
              className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
            <label className="mt-2 flex items-start gap-2 text-muted">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={filterByPincode}
                onChange={(e) => setFilterByPincode(e.target.checked)}
              />
              <span>
                <span className="block text-foreground">Filter by delivery pincode</span>
                <span className="text-xs">Shows only products delivered to this pincode.</span>
              </span>
            </label>
          </section>

          <section>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Availability
            </p>
            <label className="mt-2 flex items-center gap-2 text-muted">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
              />
              <span className="text-foreground">In Stock Only</span>
            </label>
          </section>

          <section>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Fulfillment
            </p>
            <label className="mt-2 flex items-center gap-2 text-muted">
              <input
                type="checkbox"
                checked={physical}
                onChange={(e) => setPhysical(e.target.checked)}
              />
              <span className="text-foreground">Physical</span>
            </label>
            <label className="mt-1 flex items-center gap-2 text-muted">
              <input
                type="checkbox"
                checked={digital}
                onChange={(e) => setDigital(e.target.checked)}
              />
              <span className="text-foreground">Digital</span>
            </label>
          </section>

          <button
            type="button"
            onClick={clearFilters}
            className="w-full rounded-lg border border-border px-3 py-2 text-xs font-bold hover:border-primary"
          >
            Clear Filters
          </button>
        </aside>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">{items.length} products found</p>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
          <ProductGrid items={items} onView={setViewProductId} />
        </div>
      </div>

      {viewProductId ? (
        <ProductDetailModal
          productId={viewProductId}
          onClose={() => setViewProductId(null)}
        />
      ) : null}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-surface text-foreground hover:border-primary"
      }`}
    >
      {label}
    </button>
  );
}
