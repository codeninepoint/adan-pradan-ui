"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AddressForm, emptyAddress, type AddressDraft } from "@/components/marketplace/address-form";
import { useAuth } from "@/components/auth-provider";
import { ApiError, marketplaceApi, type AddressItem, type CartLine } from "@/lib/api";

const ADDRESS_TYPES = new Set(["SHIP_PHYSICAL", "DISPATCH_SERVICE", "BOOK_APPOINTMENT"]);

function draftFrom(address: AddressItem): AddressDraft {
  return {
    label: address.label,
    contact_name: address.contact_name,
    line1: address.line1,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    phone: address.phone,
  };
}

export default function CheckoutPage() {
  const router = useRouter();
  const { tenantId, ensureAccessToken } = useAuth();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [addressId, setAddressId] = useState("");
  const [payment, setPayment] = useState("upi");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<"new" | string | null>(null);
  const [draft, setDraft] = useState<AddressDraft>(emptyAddress);

  const loadAddresses = useCallback(async () => {
    if (!tenantId) return [];
    const data = await marketplaceApi.addresses(tenantId, ensureAccessToken);
    setAddresses(data.addresses);
    return data.addresses;
  }, [tenantId, ensureAccessToken]);

  useEffect(() => {
    if (!tenantId) return;
    void marketplaceApi.cart(tenantId, ensureAccessToken).then((cart) => setLines(cart.lines));
    void loadAddresses().then((rows) => {
      if (rows[0]) setAddressId((current) => current || rows[0].address_id);
    });
  }, [tenantId, ensureAccessToken, loadAddresses]);

  const needsAddress = lines.some((line) => ADDRESS_TYPES.has(line.fulfilment_type));
  const total = lines.reduce((sum, line) => sum + line.unit_price * line.quantity, 0);

  function startEdit(address: AddressItem) {
    setEditor(address.address_id);
    setDraft(draftFrom(address));
    setAddressId(address.address_id);
    setError(null);
  }

  function startNew() {
    setEditor("new");
    setDraft(emptyAddress);
    setError(null);
  }

  async function saveAddress() {
    if (!tenantId || !editor) return;
    setError(null);
    try {
      const saved =
        editor === "new"
          ? await marketplaceApi.createAddress(tenantId, draft, ensureAccessToken)
          : await marketplaceApi.updateAddress(tenantId, editor, draft, ensureAccessToken);
      await loadAddresses();
      window.dispatchEvent(new Event("marketplace-address"));
      setAddressId(saved.address_id);
      setEditor(null);
      setDraft(emptyAddress);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not save the address.");
    }
  }

  async function onSubmit() {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    try {
      const order = await marketplaceApi.placeOrder(
        tenantId,
        {
          payment_method: payment,
          address_id: needsAddress ? addressId : addressId || undefined,
        },
        ensureAccessToken,
      );
      router.push(`/app/marketplace/orders/${order.order_id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Checkout failed.");
      setBusy(false);
    }
  }

  return (
    <div className="grid max-w-4xl gap-6 md:grid-cols-[1fr_280px]">
      <div>
        <h1 className="text-2xl font-bold">Checkout</h1>
        <p className="mt-1 text-sm text-muted">Payment is recorded on the order. Nothing is charged.</p>
        {error && <p className="mt-4 text-sm text-error">{error}</p>}
        <section className="mt-6 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Delivery address</h2>
            <button type="button" onClick={startNew} className="text-sm font-semibold text-primary">
              Add address
            </button>
          </div>
          {!needsAddress && (
            <p className="mt-2 text-sm text-muted">No physical items in this order. A delivery address is optional.</p>
          )}
          {addresses.length === 0 && editor !== "new" && (
            <p className="mt-2 text-sm text-muted">Add a delivery address to continue.</p>
          )}
          <div className="mt-3 space-y-2">
            {addresses.map((address) => (
              <div key={address.address_id} className="flex items-start justify-between gap-3 text-sm">
                <label className="flex gap-2">
                  <input
                    type="radio"
                    name="address"
                    checked={addressId === address.address_id}
                    onChange={() => setAddressId(address.address_id)}
                  />
                  <span>
                    <span className="font-semibold">{address.label}</span> · {address.line1}, {address.city}{" "}
                    {address.pincode}
                  </span>
                </label>
                <button type="button" onClick={() => startEdit(address)} className="shrink-0 font-semibold text-primary">
                  Edit
                </button>
              </div>
            ))}
          </div>
          {editor && (
            <AddressForm
              value={draft}
              onChange={setDraft}
              onSubmit={() => void saveAddress()}
              submitLabel={editor === "new" ? "Save address" : "Update address"}
              onCancel={() => setEditor(null)}
            />
          )}
        </section>
        <section className="mt-4 rounded-xl border border-border bg-surface p-4">
          <h2 className="font-semibold">Payment method</h2>
          <div className="mt-3 flex gap-4 text-sm">
            {["upi", "card", "netbanking"].map((method) => (
              <label key={method} className="flex items-center gap-2 capitalize">
                <input type="radio" name="payment" checked={payment === method} onChange={() => setPayment(method)} />
                {method}
              </label>
            ))}
          </div>
        </section>
      </div>
      <aside className="h-fit rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold">Order summary</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {lines.map((line) => (
            <li key={line.line_id} className="flex justify-between gap-3">
              <span>
                {line.product_name} × {line.quantity}
              </span>
              <span>${(line.unit_price * line.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm font-semibold">Total ${total.toFixed(2)}</p>
        <button
          type="button"
          disabled={busy || lines.length === 0 || (needsAddress && !addressId)}
          onClick={() => void onSubmit()}
          className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Placing…" : "Place order"}
        </button>
      </aside>
    </div>
  );
}
