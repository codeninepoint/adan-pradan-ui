import type { CatalogItem } from "@/lib/api";

const KEY = "adan_pradan_recent_products";

export function rememberProduct(item: CatalogItem): void {
  if (typeof window === "undefined") return;
  const current = readRecent().filter((saved) => saved.product_id !== item.product_id);
  sessionStorage.setItem(KEY, JSON.stringify([item, ...current].slice(0, 8)));
}

export function readRecent(): CatalogItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CatalogItem[]) : [];
  } catch {
    return [];
  }
}
