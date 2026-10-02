"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { canInstall, fulfilmentLabel } from "@/components/marketplace/cards";
import { ApiError, marketplaceApi, type CatalogItem } from "@/lib/api";
import { rememberProduct } from "@/lib/recent";

type Detail = {
  product_id: string;
  name: string;
  description: string;
  fulfilment_type: string;
  vendor: string;
  category: string;
  capabilities: string[];
  offerings: { offering_id: string; plan_name: string; price_usd: number; billing_period: string }[];
};

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const { tenantId, ensureAccessToken } = useAuth();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void marketplaceApi.product(params.id).then((data) => {
      setDetail(data);
      const first = data.offerings[0];
      if (first) {
        const card: CatalogItem = {
          offering_id: first.offering_id,
          product_id: data.product_id,
          product_name: data.name,
          vendor: data.vendor,
          vendor_id: "",
          plan_name: first.plan_name,
          price_usd: first.price_usd,
          billing_period: first.billing_period,
          fulfilment_type: data.fulfilment_type,
          category: data.category,
        };
        rememberProduct(card);
      }
    });
  }, [params.id]);

  async function install(offeringId: string) {
    if (!tenantId || !detail) return;
    setBusy(true);
    setError(null);
    try {
      const result = await marketplaceApi.install(
        tenantId,
        { offering_id: offeringId, accepted_capabilities: detail.capabilities },
        ensureAccessToken,
      );
      setMessage(`${detail.name} is ${result.status}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Install failed.");
    } finally {
      setBusy(false);
    }
  }

  async function add(offeringId: string) {
    if (!tenantId || !detail) return;
    setBusy(true);
    setError(null);
    try {
      await marketplaceApi.addCartLine(tenantId, { offering_id: offeringId, quantity: 1 }, ensureAccessToken);
      setMessage(`${detail.name} was added to the cart.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not add to the cart.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!tenantId || !detail) return;
    setError(null);
    try {
      await marketplaceApi.saveWishlist(tenantId, detail.product_id, ensureAccessToken);
      setMessage("Saved to the wishlist.");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not save.");
    }
  }

  if (!detail) return <p className="text-sm text-muted">Loading product…</p>;

  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase text-muted">{detail.category}</p>
      <h1 className="mt-1 text-2xl font-bold">{detail.name}</h1>
      <p className="mt-1 text-sm text-muted">
        {detail.vendor} · {fulfilmentLabel(detail.fulfilment_type)}
      </p>
      {detail.description && <p className="mt-4 text-sm">{detail.description}</p>}
      <p className="mt-4 text-sm">
        <span className="font-semibold">Capabilities: </span>
        {detail.capabilities.length ? detail.capabilities.join(", ") : "none"}
      </p>
      {message && <p className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      <div className="mt-6 space-y-3">
        {detail.offerings.map((offering) => (
          <div key={offering.offering_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
            <p className="text-sm">
              <span className="font-semibold">{offering.plan_name}</span>
              <span className="text-muted">
                {" "}
                · ${offering.price_usd} / {offering.billing_period}
              </span>
            </p>
            {canInstall(detail.fulfilment_type) ? (
              <button type="button" disabled={busy} onClick={() => void install(offering.offering_id)} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
                Install
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => void add(offering.offering_id)} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
                Add to cart
              </button>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => void save()} className="mt-4 text-sm font-semibold text-primary">
        Save to wishlist
      </button>
    </div>
  );
}
