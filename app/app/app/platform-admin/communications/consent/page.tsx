"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi } from "@/lib/api";

export default function CommunicationsConsentPage() {
  const { ensureAccessToken } = useAuth();
  const [data, setData] = useState<{
    sms_optouts: number;
    whatsapp_optouts: number;
    email_unsubs: number;
    dnd_scrub_today: number;
    note: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setData(await platformAdminApi.communicationConsent(ensureAccessToken));
  }, [ensureAccessToken]);

  useEffect(() => {
    void load()
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.detail : "Could not load consent registry."),
      )
      .finally(() => setLoading(false));
  }, [load]);

  if (loading || !data) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted">Loading consent registry…</p>
        {error && <p className="mt-2 text-sm text-error">{error}</p>}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Consent & Opt-out Registry</h1>
      <p className="mt-1 text-sm text-muted">
        Central opt-out table. Enforced automatically across all 4 channels for all vendors.
      </p>

      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800">
        {data.note}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "SMS Opt-outs", value: data.sms_optouts, color: "text-rose-600" },
          { label: "WhatsApp Opt-outs", value: data.whatsapp_optouts, color: "text-rose-600" },
          { label: "Email Unsubs", value: data.email_unsubs, color: "text-rose-600" },
          {
            label: "DND Scrub Today",
            value: data.dnd_scrub_today,
            color: "text-emerald-600",
            hint: "Numbers scrubbed from batch",
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-surface p-4">
            <p className={`text-2xl font-extrabold ${stat.color}`}>{stat.value.toLocaleString()}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{stat.label}</p>
            {"hint" in stat && stat.hint ? (
              <p className="mt-1 text-[11px] text-muted">{stat.hint}</p>
            ) : null}
          </div>
        ))}
      </div>
    </main>
  );
}
