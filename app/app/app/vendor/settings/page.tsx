"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, VendorSettings, vendorApi } from "@/lib/api";

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

export default function VendorSettingsPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [settings, setSettings] = useState<VendorSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!vendor) return;
    setSettings(await vendorApi.settings(vendor.vendor_id, ensureAccessToken));
  }, [vendor, ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load settings.");
    });
  }, [load]);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vendor) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const saved = await vendorApi.updateSettings(
        vendor.vendor_id,
        {
          support_email: String(data.get("support_email") ?? ""),
          bank_account_name: String(data.get("bank_account_name") ?? ""),
          bank_account_number: String(data.get("bank_account_number") ?? ""),
          bank_ifsc: String(data.get("bank_ifsc") ?? ""),
        },
        ensureAccessToken,
      );
      setSettings(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  if (!vendor) return null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Vendor settings</h1>
      <p className="mt-1 text-sm text-muted">
        Support email and bank details. Legal name and tax id stay as written at registration.
      </p>
      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      <section className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm">
        <h2 className="font-semibold">Business profile</h2>
        <p className="mt-3 text-muted">Legal name</p>
        <p className="font-semibold">{settings?.legal_name ?? vendor.legal_name}</p>
        <p className="mt-3 text-muted">Tax id</p>
        <p className="font-semibold">{settings?.tax_id || "—"}</p>
      </section>
      {settings && (
        <form key={settings.bank_account_number + settings.bank_ifsc + settings.support_email} onSubmit={(event) => void onSave(event)} className="mt-4 space-y-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="font-semibold">Payout details</h2>
          <label className="block text-xs font-semibold text-muted">
            Support email
            <input name="support_email" type="email" required defaultValue={settings.support_email} className={inputClass} />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Account holder
            <input name="bank_account_name" required defaultValue={settings.bank_account_name} className={inputClass} />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Account number
            <input name="bank_account_number" required defaultValue={settings.bank_account_number} className={inputClass} />
          </label>
          <label className="block text-xs font-semibold text-muted">
            IFSC
            <input name="bank_ifsc" required defaultValue={settings.bank_ifsc} className={inputClass} />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save settings"}
          </button>
        </form>
      )}
    </div>
  );
}
