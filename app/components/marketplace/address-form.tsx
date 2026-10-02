"use client";

import { FormEvent } from "react";
import type { AddressItem } from "@/lib/api";

export type AddressDraft = Omit<AddressItem, "address_id">;

export const emptyAddress: AddressDraft = {
  label: "",
  contact_name: "",
  line1: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
};

const FIELDS = [
  ["label", "Label"],
  ["contact_name", "Contact name"],
  ["line1", "Address"],
  ["city", "City"],
  ["state", "State"],
  ["pincode", "Pincode"],
  ["phone", "Phone"],
] as const;

export function AddressForm({
  value,
  onChange,
  onSubmit,
  submitLabel,
  onCancel,
}: {
  value: AddressDraft;
  onChange: (next: AddressDraft) => void;
  onSubmit: () => void;
  submitLabel: string;
  onCancel?: () => void;
}) {
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
      {FIELDS.map(([key, label]) => (
        <label key={key} className="text-xs font-semibold text-muted">
          {label}
          <input
            required
            value={value[key]}
            onChange={(event) => onChange({ ...value, [key]: event.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
      ))}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
