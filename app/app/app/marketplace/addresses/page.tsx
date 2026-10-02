"use client";

import { useCallback, useEffect, useState } from "react";
import { AddressForm, emptyAddress, type AddressDraft } from "@/components/marketplace/address-form";
import { useAuth } from "@/components/auth-provider";
import { ApiError, marketplaceApi, type AddressItem } from "@/lib/api";

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

export default function AddressesPage() {
  const { tenantId, ensureAccessToken } = useAuth();
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [form, setForm] = useState<AddressDraft>(emptyAddress);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const data = await marketplaceApi.addresses(tenantId, ensureAccessToken);
    setAddresses(data.addresses);
  }, [tenantId, ensureAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit() {
    if (!tenantId) return;
    setError(null);
    try {
      if (editingId) {
        await marketplaceApi.updateAddress(tenantId, editingId, form, ensureAccessToken);
      } else {
        await marketplaceApi.createAddress(tenantId, form, ensureAccessToken);
      }
      setForm(emptyAddress);
      setEditingId(null);
      await load();
      window.dispatchEvent(new Event("marketplace-address"));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not save the address.");
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Addresses</h1>
      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      <ul className="mt-4 space-y-3 text-sm">
        {addresses.map((address) => (
          <li key={address.address_id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4">
            <p>
              <span className="font-semibold">{address.label}</span>
              <br />
              {address.contact_name}, {address.line1}, {address.city}, {address.state} {address.pincode}
              <br />
              {address.phone}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="font-semibold text-primary"
                onClick={() => {
                  setEditingId(address.address_id);
                  setForm(draftFrom(address));
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="font-semibold text-primary"
                onClick={() => {
                  if (!tenantId) return;
                  void marketplaceApi.deleteAddress(tenantId, address.address_id, ensureAccessToken).then(() => {
                    window.dispatchEvent(new Event("marketplace-address"));
                    return load();
                  });
                }}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold">{editingId ? "Edit address" : "Add address"}</h2>
        <AddressForm
          value={form}
          onChange={setForm}
          onSubmit={() => void onSubmit()}
          submitLabel={editingId ? "Update address" : "Save address"}
          onCancel={
            editingId
              ? () => {
                  setEditingId(null);
                  setForm(emptyAddress);
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
