"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, marketplaceApi, type CatalogItem } from "@/lib/api";

const LABELS: Record<string, string> = {
  SHIP_PHYSICAL: "Ships to you",
  DELIVER_DIGITAL: "Digital delivery",
  LICENSE_SOFTWARE: "License",
  PROVISION_SOFTWARE: "Installs in your tenant",
  PROVISION_CLOUD: "Cloud provision",
  STREAM_LMS_COURSE: "Course",
  DELIVER_MULTIMEDIA: "Stream",
  DISPATCH_SERVICE: "Service dispatch",
  BOOK_APPOINTMENT: "Appointment",
};

export const FULFILMENT_CHIPS: { code: string; label: string }[] = [
  { code: "SHIP_PHYSICAL", label: "Ecommerce" },
  { code: "DELIVER_DIGITAL", label: "Digital Products" },
  { code: "LICENSE_SOFTWARE", label: "Software Products" },
  { code: "PROVISION_SOFTWARE", label: "Software & SaaS" },
  { code: "PROVISION_CLOUD", label: "Cloud Services" },
  { code: "STREAM_LMS_COURSE", label: "LMS & Courses" },
  { code: "DELIVER_MULTIMEDIA", label: "Multimedia" },
  { code: "DISPATCH_SERVICE", label: "Field Services" },
  { code: "BOOK_APPOINTMENT", label: "Appointments" },
];

export function fulfilmentLabel(code: string): string {
  return LABELS[code] ?? code;
}

export function canInstall(code: string): boolean {
  return code === "PROVISION_SOFTWARE" || code === "PROVISION_CLOUD";
}

function money(amount: number): string {
  return `$${Number(amount).toFixed(2)}`;
}

export function ProductCard({ item }: { item: CatalogItem }) {
  const { tenantId, ensureAccessToken } = useAuth();
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const install = canInstall(item.fulfilment_type);

  async function save() {
    if (!tenantId) return;
    setNote(null);
    try {
      await marketplaceApi.saveWishlist(tenantId, item.product_id, ensureAccessToken);
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSaved(true);
        return;
      }
      setNote(err instanceof ApiError ? err.detail : "Could not save.");
    }
  }

  async function add() {
    if (!tenantId) return;
    setNote(null);
    try {
      await marketplaceApi.addCartLine(
        tenantId,
        { offering_id: item.offering_id, quantity: 1 },
        ensureAccessToken,
      );
      setNote("Added");
      window.dispatchEvent(new Event("marketplace-cart"));
    } catch (err) {
      setNote(err instanceof ApiError ? err.detail : "Could not add to cart.");
    }
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <Link href={`/app/marketplace/products/${item.product_id}`} className="block">
        <div className="flex h-28 items-end bg-[var(--hero-tint)] p-3">
          <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
            {fulfilmentLabel(item.fulfilment_type)}
          </span>
        </div>
        <div className="p-4 pb-2">
          <p className="font-semibold text-foreground">{item.product_name}</p>
          <p className="text-sm text-muted">{item.vendor}</p>
          <p className="mt-3 text-sm text-foreground">
            {money(item.price_usd)} <span className="text-muted">/ {item.billing_period}</span>
          </p>
        </div>
      </Link>
      <div className="mt-auto flex items-center justify-end gap-2 px-4 pb-4">
        {note && <span className="mr-auto text-xs text-muted">{note}</span>}
        <button
          type="button"
          aria-label={saved ? "Saved to wishlist" : "Save to wishlist"}
          onClick={() => void save()}
          className={`grid h-9 w-9 place-items-center rounded-lg border border-border ${saved ? "text-primary" : "text-muted"}`}
        >
          <Heart filled={saved} />
        </button>
        {install ? (
          <Link
            href={`/app/marketplace/products/${item.product_id}`}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
          >
            Install
          </Link>
        ) : (
          <button
            type="button"
            aria-label="Add to cart"
            onClick={() => void add()}
            className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"
          >
            <CartIcon />
          </button>
        )}
      </div>
    </article>
  );
}

export function ProductGrid({
  items,
  empty = "Nothing is published in this view yet.",
}: {
  items: CatalogItem[];
  empty?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">{empty}</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <ProductCard key={item.offering_id} item={item} />
      ))}
    </div>
  );
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 6h15l-1.5 9h-12z" />
      <path d="M6 6 5 3H2" />
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </svg>
  );
}
