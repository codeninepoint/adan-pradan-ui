"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckoutModal } from "@/components/marketplace/checkout-modal";

export default function CheckoutPage() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
  }, []);

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">Checkout</h1>
      <p className="mt-2 text-sm text-muted">Complete your order in the checkout dialog.</p>
      <CheckoutModal
        open={open}
        onClose={() => {
          setOpen(false);
          router.push("/app/marketplace");
        }}
        onPlaced={(orderId) => {
          setOpen(false);
          router.push(`/app/marketplace/orders/${orderId}`);
        }}
      />
    </div>
  );
}
