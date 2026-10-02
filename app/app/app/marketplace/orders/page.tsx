"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { marketplaceApi, type OrderSummary } from "@/lib/api";

export default function OrdersPage() {
  const { tenantId, ensureAccessToken } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    void marketplaceApi.orders(tenantId, ensureAccessToken).then((data) => setOrders(data.orders));
  }, [tenantId, ensureAccessToken]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Orders & tracking</h1>
      {orders.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No orders yet.</p>
      ) : (
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted">
            <tr>
              <th className="py-2">Order</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.order_id} className="border-t border-border">
                <td className="py-3">
                  <Link href={`/app/marketplace/orders/${order.order_id}`} className="font-semibold text-primary">
                    {order.order_id.slice(0, 8)}
                  </Link>
                </td>
                <td>{order.status}</td>
                <td className="capitalize">{order.payment_method}</td>
                <td>${order.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
