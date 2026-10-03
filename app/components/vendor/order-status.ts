export const ORDER_STATUS_LABELS: Record<string, string> = {
  placed: "New",
  confirmed: "Confirmed",
  processing: "Processing",
  ready_to_ship: "Ready to Ship",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export const ORDER_STEPPER = ["placed", "confirmed", "processing", "ready_to_ship", "shipped", "delivered"];

export function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? status;
}
