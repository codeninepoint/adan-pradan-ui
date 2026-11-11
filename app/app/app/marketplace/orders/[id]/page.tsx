"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OrderDetailPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/marketplace/orders");
  }, [router]);

  return <p className="text-sm text-muted">Opening orders…</p>;
}
