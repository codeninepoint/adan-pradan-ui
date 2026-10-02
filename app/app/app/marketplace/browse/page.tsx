"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FULFILMENT_CHIPS, ProductGrid } from "@/components/marketplace/cards";
import { marketplaceApi, type CatalogItem } from "@/lib/api";

export default function BrowsePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading browse…</p>}>
      <BrowseBody />
    </Suspense>
  );
}

function BrowseBody() {
  const params = useSearchParams();
  const type = params.get("type") ?? "";
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "");
  const [sort, setSort] = useState("newest");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [items, setItems] = useState<CatalogItem[]>([]);

  useEffect(() => {
    setQuery(params.get("q") ?? "");
    setCategory(params.get("category") ?? "");
  }, [params]);

  useEffect(() => {
    void marketplaceApi
      .catalog({
        q: query.trim() || undefined,
        category: category.trim() || undefined,
        sort,
        verified_only: verifiedOnly,
        price_min: priceMin || undefined,
        price_max: priceMax || undefined,
      })
      .then((data) =>
        setItems(type ? data.results.filter((item) => item.fulfilment_type === type) : data.results),
      );
  }, [query, category, sort, verifiedOnly, priceMin, priceMax, type]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {FULFILMENT_CHIPS.find((chip) => chip.code === type)?.label || category || "Browse All"}
      </h1>
      <p className="mt-1 text-sm text-muted">Every listing on the marketplace, filterable by category and price.</p>
      <form onSubmit={onSubmit} className="mt-5 grid gap-4 md:grid-cols-[220px_1fr]">
        <aside className="space-y-3 rounded-xl border border-border bg-surface p-4 text-sm">
          <label className="block text-xs font-semibold text-muted">
            Search
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Category
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Min price
            <input value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Max price
            <input value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
            Verified vendors only
          </label>
          <label className="block text-xs font-semibold text-muted">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground">
              <option value="newest">Newest</option>
              <option value="price_asc">Price, low to high</option>
              <option value="price_desc">Price, high to low</option>
            </select>
          </label>
        </aside>
        <ProductGrid items={items} />
      </form>
    </div>
  );
}
