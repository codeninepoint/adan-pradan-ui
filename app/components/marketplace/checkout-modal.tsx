"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AddressForm, emptyAddress, type AddressDraft } from "@/components/marketplace/address-form";
import { useAuth } from "@/components/auth-provider";
import {
  cartTotalWithGst,
  groupLinesByVendor,
} from "@/components/marketplace/commerce-money";
import { ApiError, marketplaceApi, type AddressItem, type CartLine } from "@/lib/api";
import { formatMoney } from "@/lib/money";

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

export function CheckoutModal({
  open,
  onClose,
  onPlaced,
}: {
  open: boolean;
  onClose: () => void;
  onPlaced?: (orderId: string) => void;
}) {
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
    if (!open || !tenantId) return;
    void marketplaceApi.cart(tenantId, ensureAccessToken).then((cart) => setLines(cart.lines));
    void loadAddresses().then((rows) => {
      if (rows[0]) setAddressId((current) => current || rows[0].address_id);
    });
  }, [open, tenantId, ensureAccessToken, loadAddresses]);

  const needsAddress = lines.some((line) => ADDRESS_TYPES.has(line.fulfilment_type));
  const groups = groupLinesByVendor(lines);
  const totals = cartTotalWithGst(lines);
  const vendorCount = groups.length;

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
      window.dispatchEvent(new Event("marketplace-cart"));
      onClose();
      if (onPlaced) {
        onPlaced(order.order_id);
      } else {
        router.push(`/app/marketplace/orders/${order.order_id}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Checkout failed.");
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Checkout"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-bold">Checkout</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-2 py-1 text-sm text-muted"
            aria-label="Close checkout"
          >
            ✕
          </button>
        </div>

        {error && <p className="px-5 pt-4 text-sm text-error">{error}</p>}

        <div className="grid gap-6 p-5 md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-5">
            <section>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
                  Delivery address
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setEditor("new");
                    setDraft(emptyAddress);
                    setError(null);
                  }}
                  className="text-xs font-semibold text-primary"
                >
                  + Add New Address
                </button>
              </div>
              {!needsAddress && (
                <p className="mt-2 text-xs text-muted">Address optional for this cart.</p>
              )}
              <div className="mt-3 space-y-2">
                {addresses.map((address) => (
                  <label
                    key={address.address_id}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${
                      addressId === address.address_id
                        ? "border-primary bg-[var(--hero-tint)]"
                        : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="checkout-address"
                      checked={addressId === address.address_id}
                      onChange={() => setAddressId(address.address_id)}
                    />
                    <span>
                      <span className="font-semibold">{address.label}</span>
                      <span className="mt-0.5 block text-muted">
                        {address.line1}, {address.city} - {address.pincode}
                      </span>
                    </span>
                  </label>
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

            <section>
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
                Order summary
              </h3>
              <div className="mt-3 space-y-4">
                {groups.map((group) => (
                  <div key={group.vendor_id} className="rounded-xl border border-border p-3">
                    <p className="text-xs font-bold text-primary">{group.vendor_name}</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {group.lines.map((line) => (
                        <li key={line.line_id} className="flex justify-between gap-2">
                          <span>
                            {line.product_name} × {line.quantity}
                          </span>
                          <span>
                            {formatMoney(line.unit_price * line.quantity, line.currency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section>
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
                Payment method
              </h3>
              <div className="mt-3 space-y-2 text-sm">
                {[
                  ["upi", "UPI / PhonePe / GPay"],
                  ["card", "Credit / Debit Card"],
                  ["netbanking", "Net Banking"],
                ].map(([id, label]) => (
                  <label
                    key={id}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 ${
                      payment === id ? "border-primary bg-[var(--hero-tint)]" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="checkout-payment"
                      checked={payment === id}
                      onChange={() => setPayment(id)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-border p-4">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">
                    Subtotal ({itemCountLabel(lines)})
                  </dt>
                  <dd>{formatMoney(totals.subtotal, totals.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">GST (18%)</dt>
                  <dd>{formatMoney(totals.gst, totals.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Shipping</dt>
                  <dd className="text-success">FREE</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                  <dt>Total Payable</dt>
                  <dd className="text-success">{formatMoney(totals.total, totals.currency)}</dd>
                </div>
              </dl>
              <p className="mt-3 rounded-lg bg-[var(--hero-tint)] px-3 py-2 text-xs text-muted">
                {vendorCount} vendor suborder{vendorCount === 1 ? "" : "s"} will be created.
                Payment is recorded on the order — nothing is charged.
              </p>
              <button
                type="button"
                disabled={busy || lines.length === 0 || (needsAddress && !addressId)}
                onClick={() => void onSubmit()}
                className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {busy
                  ? "Placing…"
                  : `Pay ${formatMoney(totals.total, totals.currency)} Securely`}
              </button>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function itemCountLabel(lines: CartLine[]): string {
  const n = lines.reduce((sum, line) => sum + line.quantity, 0);
  return `${n} item${n === 1 ? "" : "s"}`;
}
