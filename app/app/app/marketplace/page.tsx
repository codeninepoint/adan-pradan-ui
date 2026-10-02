"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FULFILMENT_CHIPS, ProductGrid } from "@/components/marketplace/cards";
import { marketplaceApi, type CatalogItem } from "@/lib/api";

export default function MarketplaceHomePage() {
  const [rails, setRails] = useState<Record<string, CatalogItem[]>>({});

  useEffect(() => {
    void marketplaceApi.home().then((data) => setRails(data.rails));
  }, []);

  const launch = (rails.new ?? [])[0];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Find what your organisation needs</h1>
      <p className="mt-1 text-sm text-muted">
        Products and services from verified vendors. Software and cloud offerings install into this tenant. Everything else goes through the cart.
      </p>
      {launch && (
        <Link
          href={`/app/marketplace/products/${launch.product_id}`}
          className="mt-6 block overflow-hidden rounded-2xl border border-border bg-[var(--hero-tint)] p-6"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">New launch</p>
          <p className="mt-2 text-xl font-bold text-foreground">{launch.product_name}</p>
          <p className="mt-1 text-sm text-muted">{launch.vendor}</p>
          <p className="mt-4 text-sm font-semibold text-foreground">
            ${Number(launch.price_usd).toFixed(2)} <span className="font-normal text-muted">/ {launch.billing_period}</span>
          </p>
        </Link>
      )}
      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {FULFILMENT_CHIPS.map((chip) => (
          <Link
            key={chip.code}
            href={`/app/marketplace/browse?type=${encodeURIComponent(chip.code)}`}
            className="shrink-0 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary"
          >
            {chip.label}
          </Link>
        ))}
      </div>
      <Section title="New launches" items={rails.new ?? []} />
      <Section title="Sponsored" items={rails.sponsored ?? []} empty="Nothing is sponsored yet." />
      <Section title="Trending" items={rails.trending ?? []} />
    </div>
  );
}

function Section({ title, items, empty }: { title: string; items: CatalogItem[]; empty?: string }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-bold">{title}</h2>
      <ProductGrid items={items} empty={empty} />
    </section>
  );
}
