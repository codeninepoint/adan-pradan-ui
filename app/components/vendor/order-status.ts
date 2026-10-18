export const ORDER_STATUS_LABELS: Record<string, string> = {
  placed: "New",
  confirmed: "Confirmed",
  processing: "Processing",
  delayed: "Delayed",
  ready_to_ship: "Ready to Ship",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export const ORDER_STEPPER = [
  "placed",
  "confirmed",
  "processing",
  "ready_to_ship",
  "shipped",
  "delivered",
];

/** Display labels for the Fulfilment Pipeline Kanban / table (not the Orders stepper). */
export const PIPELINE_COLUMN_LABELS = {
  to_pack: "To Pack",
  packed: "Packed",
  in_transit: "In Transit",
  ofd: "Out for delivery",
} as const;

export const PIPELINE_STATUS_LABELS: Record<string, string> = {
  confirmed: "To Pack",
  processing: "To Pack",
  ready_to_ship: "Packed",
  shipped: "In Transit",
};

export function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function pipelineStatusLabel(status: string) {
  return PIPELINE_STATUS_LABELS[status] ?? orderStatusLabel(status);
}
