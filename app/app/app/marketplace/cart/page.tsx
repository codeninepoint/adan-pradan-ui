"use client";

import { useEffect } from "react";

export default function CartPage() {
  useEffect(() => {
    window.dispatchEvent(new Event("marketplace-open-cart"));
  }, []);

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">Cart</h1>
      <p className="mt-2 text-sm text-muted">
        Your cart opens in the side panel. Use the cart icon anytime to review items grouped by vendor.
      </p>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("marketplace-open-cart"))}
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
      >
        Open cart
      </button>
    </div>
  );
}
