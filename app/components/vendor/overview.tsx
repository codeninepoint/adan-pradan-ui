"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { fulfilmentLabel } from "@/components/marketplace/cards";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi } from "@/lib/api";

type PortalSummary = {
  status: string;
  product_count: number;
  offering_count: number;
  active_installs: number;
  pending_plugin_reviews: number;
};

type ProductRow = {
  product_id: string;
  name: string;
  status: string;
  fulfilment_type: string;
  category: string;
};

type InstallRow = {
  installation_id: string;
  tenant_name: string;
  product_name: string;
  fulfilment_type: string;
  status: string;
  since: string;
};

export function VendorOverview() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [summary, setSummary] = useState<PortalSummary | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [installs, setInstalls] = useState<InstallRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendor) return;
    const vendorId = vendor.vendor_id;
    let cancelled = false;
    void Promise.all([
      marketplaceApi.portal(vendorId, ensureAccessToken),
      marketplaceApi.vendorProducts(vendorId, ensureAccessToken),
      marketplaceApi.vendorInstallations(vendorId, ensureAccessToken),
    ])
      .then(([portal, productData, installData]) => {
        if (cancelled) return;
        setSummary(portal);
        setProducts(productData.products);
        setInstalls(installData.installations);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : "Could not load the vendor portal.");
      });
    return () => {
      cancelled = true;
    };
  }, [vendor, ensureAccessToken]);

  if (!vendor) return null;

  const counts = [
    ["Products", summary?.product_count],
    ["Offerings", summary?.offering_count],
    ["Active installs", summary?.active_installs],
    ["Versions in review", summary?.pending_plugin_reviews],
  ] as const;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{vendor.legal_name}</h1>
      <p className="mt-1 text-sm text-muted">
        Portal status {summary?.status ?? vendor.status}. Plugin registration and publishing stay on{" "}
        <Link href="/app/plugins" className="font-semibold text-primary hover:underline">
          Plugins
        </Link>
        .
      </p>
      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {counts.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-2xl font-bold text-foreground">{value ?? "—"}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          </div>
        ))}
      </div>
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">Products</h2>
          <Link href="/app/vendor/products" className="text-sm font-semibold text-primary hover:underline">
            Manage
          </Link>
        </div>
        {products.length === 0 ? (
          <p className="text-sm text-muted">No products yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {products.map((product) => (
              <li key={product.product_id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-foreground">{product.name}</p>
                  <p className="text-muted">
                    {fulfilmentLabel(product.fulfilment_type)}
                    {product.category ? ` · ${product.category}` : ""}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase text-muted">{product.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold">Installations</h2>
        {installs.length === 0 ? (
          <p className="text-sm text-muted">No installs yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {installs.map((install) => (
              <li key={install.installation_id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-foreground">{install.product_name}</p>
                  <p className="text-muted">
                    {install.tenant_name} · {fulfilmentLabel(install.fulfilment_type)}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase text-muted">{install.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
