"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, vendorApi } from "@/lib/api";

export default function VendorNotificationsPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [notifyInstall, setNotifyInstall] = useState(true);
  const [notifyPayout, setNotifyPayout] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!vendor) return;
    const data = await vendorApi.settings(vendor.vendor_id, ensureAccessToken);
    setNotifyInstall(data.notify_install);
    setNotifyPayout(data.notify_payout);
  }, [vendor, ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load notification settings.");
    });
  }, [load]);

  async function save(next: { notify_install?: boolean; notify_payout?: boolean }) {
    if (!vendor) return;
    setBusy(true);
    setError(null);
    try {
      const data = await vendorApi.updateSettings(vendor.vendor_id, next, ensureAccessToken);
      setNotifyInstall(data.notify_install);
      setNotifyPayout(data.notify_payout);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not save notification settings.");
    } finally {
      setBusy(false);
    }
  }

  if (!vendor) return null;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
      <p className="mt-1 text-sm text-muted">Alerts stored on this vendor&apos;s settings.</p>
      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
        <Toggle
          label="Install"
          checked={notifyInstall}
          disabled={busy}
          onChange={(checked) => void save({ notify_install: checked })}
        />
        <Toggle
          label="Payout"
          checked={notifyPayout}
          disabled={busy}
          onChange={(checked) => void save({ notify_payout: checked })}
        />
      </ul>
    </div>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <span className="font-semibold">{label}</span>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={`rounded-full px-3 py-1 text-xs font-bold ${
          checked ? "bg-primary text-primary-foreground" : "border border-border text-muted"
        }`}
      >
        {checked ? "On" : "Off"}
      </button>
    </li>
  );
}
