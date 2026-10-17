export const ALLOWED_CURRENCIES = ["INR", "USD", "EUR", "AED", "GBP"] as const;

export type CurrencyCode = (typeof ALLOWED_CURRENCIES)[number];

export function formatMoney(amount: number, currency: string = "INR"): string {
  const code = (currency || "INR").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: code === "INR" ? 0 : 2,
      minimumFractionDigits: code === "INR" ? 0 : 2,
    }).format(Number(amount) || 0);
  } catch {
    return `${code} ${Number(amount).toFixed(2)}`;
  }
}

/** Compact INR for large stats (₹2.4L / ₹1.2Cr); otherwise formatMoney. */
export function formatCompactMoney(amount: number, currency: string = "INR"): string {
  const code = (currency || "INR").toUpperCase();
  const value = Number(amount) || 0;
  if (code === "INR" && Math.abs(value) >= 1e5) {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1e7) {
      const cr = abs / 1e7;
      const text = cr >= 10 ? cr.toFixed(0) : cr.toFixed(1).replace(/\.0$/, "");
      return `${sign}₹${text}Cr`;
    }
    const lakh = abs / 1e5;
    const text = lakh >= 10 ? lakh.toFixed(0) : lakh.toFixed(1).replace(/\.0$/, "");
    return `${sign}₹${text}L`;
  }
  return formatMoney(value, code);
}
