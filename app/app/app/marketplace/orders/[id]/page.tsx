"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { OrderDetailModal } from "@/components/marketplace/order-detail-modal";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  return (
    <div className="max-w-xl">
      <p className="text-sm text-muted">
        <Link href="/app/marketplace/orders" className="text-primary">
          Orders
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold">Order details</h1>
      <OrderDetailModal
        orderId={params.id}
        onClose={() => router.push("/app/marketplace/orders")}
        onUpdated={() => router.refresh()}
      />
    </div>
  );
}
