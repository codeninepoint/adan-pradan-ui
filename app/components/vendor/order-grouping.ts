export type VendorOrderLine = {
  order_id: string;
  line_id: string;
  product_name: string;
  quantity: number;
  total: number;
  currency: string;
  status: string;
  placed_at: string;
  customer_name: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  courier: string;
  tracking_number: string;
  fulfilment_type?: string;
};

export type VendorOrder = VendorOrderLine & { items: VendorOrderLine[]; amount: number };

export function groupVendorOrders(lines: VendorOrderLine[]): VendorOrder[] {
  const grouped = new Map<string, VendorOrder>();
  for (const line of lines) {
    const current = grouped.get(line.order_id);
    if (!current) {
      grouped.set(line.order_id, { ...line, items: [line], amount: line.total });
      continue;
    }
    current.items.push(line);
    current.amount += line.total;
  }
  return [...grouped.values()];
}

export function itemSummary(items: VendorOrderLine[]): string {
  return items.map((item) => `${item.product_name} ×${item.quantity}`).join(", ");
}

export function itemCountLabel(items: VendorOrderLine[]): string {
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  return count === 1 ? "1 item" : `${count} items`;
}

/** Steps from confirmed/processing up to ready_to_ship (Mark Packed). */
export const PACK_ADVANCE_STEPS: Record<string, string[]> = {
  confirmed: ["processing", "ready_to_ship"],
  processing: ["ready_to_ship"],
};

export async function advanceToReadyToShip(
  status: string,
  advance: (nextStatus: string) => Promise<void>,
): Promise<void> {
  const steps = PACK_ADVANCE_STEPS[status];
  if (!steps) {
    throw new Error(`Cannot pack from status ${status}`);
  }
  for (const next of steps) {
    await advance(next);
  }
}

export type PipelineColumnId = "to_pack" | "packed" | "in_transit" | "ofd";

export function pipelineColumnForStatus(status: string): PipelineColumnId | null {
  if (status === "confirmed" || status === "processing") return "to_pack";
  if (status === "ready_to_ship") return "packed";
  if (status === "shipped") return "in_transit";
  return null;
}

export function ordersInPipelineColumn(
  orders: VendorOrder[],
  column: PipelineColumnId,
): VendorOrder[] {
  if (column === "ofd") return [];
  return orders.filter((order) => pipelineColumnForStatus(order.status) === column);
}
