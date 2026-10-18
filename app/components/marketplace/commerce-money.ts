import type { CartLine } from "@/lib/api";

export const GST_RATE = 0.18;

export function groupLinesByVendor<T extends { vendor_id: string; vendor_name: string }>(
  lines: T[],
): { vendor_id: string; vendor_name: string; lines: T[] }[] {
  const map = new Map<string, { vendor_id: string; vendor_name: string; lines: T[] }>();
  for (const line of lines) {
    const key = line.vendor_id || line.vendor_name || "unknown";
    const bucket = map.get(key);
    if (bucket) {
      bucket.lines.push(line);
    } else {
      map.set(key, {
        vendor_id: line.vendor_id,
        vendor_name: line.vendor_name || "Vendor",
        lines: [line],
      });
    }
  }
  return Array.from(map.values());
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.unit_price * line.quantity, 0);
}

export function gstAmount(subtotal: number): number {
  return Math.round(subtotal * GST_RATE * 100) / 100;
}

export function cartTotalWithGst(lines: CartLine[]): {
  subtotal: number;
  gst: number;
  total: number;
  currency: string;
} {
  const subtotal = cartSubtotal(lines);
  const gst = gstAmount(subtotal);
  return {
    subtotal,
    gst,
    total: Math.round((subtotal + gst) * 100) / 100,
    currency: lines[0]?.currency || "INR",
  };
}
