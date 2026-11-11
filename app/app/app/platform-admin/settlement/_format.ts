export function inr(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(abs) ? 0 : 2,
  });
  return `${value < 0 ? "−" : ""}₹${formatted}`;
}

export function batchStatusLabel(status: string, utr: string | null): string {
  if (status === "done") return utr ? `Done · UTR ${utr}` : "Done";
  if (status === "failed_retry") return "1 Failed — retry";
  if (status === "pending") return "Pending";
  return status;
}

export function ledgerStatusLabel(status: string): string {
  const map: Record<string, string> = {
    return_contested: "Return Contested",
    vendor_fault: "Vendor Fault",
    settled: "Settled",
  };
  return map[status] ?? status;
}

export function reasonLabel(code: string): string {
  const map: Record<string, string> = {
    wrong_item: "Wrong Item",
    missing_item: "Missing Item",
    double_charge: "Double Charge",
    timeout: "Timed Out",
  };
  return map[code] ?? code.replace(/_/g, " ");
}
