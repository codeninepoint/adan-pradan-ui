"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import {
  ApiError,
  marketplaceApi,
  ProductCityAssignmentItem,
  ServiceCityItem,
} from "@/lib/api";
import { ALLOWED_CURRENCIES } from "@/lib/money";

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const buttonClass =
  "cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const ghostClass =
  "cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

function parsePincodes(raw: string): string[] {
  return [...new Set(raw.split(/[,\n]/).map((p) => p.trim()).filter(Boolean))];
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="my-8 w-full max-w-lg rounded-xl border border-border bg-surface p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" className={ghostClass} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export default function VendorLocationsPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [cities, setCities] = useState<ServiceCityItem[]>([]);
  const [assignments, setAssignments] = useState<ProductCityAssignmentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [addingCity, setAddingCity] = useState(false);
  const [editingCity, setEditingCity] = useState<ServiceCityItem | null>(null);
  const [assignProduct, setAssignProduct] = useState<ProductCityAssignmentItem | null>(null);

  const load = useCallback(async () => {
    if (!vendor) return;
    const vendorId = vendor.vendor_id;
    const [cityData, assignmentData] = await Promise.all([
      marketplaceApi.serviceCities(vendorId, ensureAccessToken),
      marketplaceApi.productCityAssignments(vendorId, ensureAccessToken),
    ]);
    setCities(cityData.cities);
    setAssignments(assignmentData.items);
  }, [vendor, ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load locations.");
    });
  }, [load]);

  const totalPincodes = useMemo(
    () => cities.reduce((sum, city) => sum + city.pincodes.length, 0),
    [cities],
  );
  const unassignedCount = useMemo(
    () => assignments.filter((item) => item.cities.length === 0).length,
    [assignments],
  );

  async function run(key: string, action: () => Promise<void>) {
    setError(null);
    setBusy(key);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Request failed.");
    } finally {
      setBusy(null);
    }
  }

  if (!vendor) return null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Locations & Pincodes</h1>
          <p className="mt-1 text-sm text-muted">
            Manage serviceable zones. Customers only see your products if their pincode is covered.
          </p>
        </div>
        <button type="button" className={buttonClass} onClick={() => setAddingCity(true)}>
          + Add City
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
        Products without any pincode assigned are <strong>not visible to any customer</strong>. Assign at least
        one city to each product after setting up coverage here.
      </div>

      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-2xl font-bold">{cities.length}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">Cities covered</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-2xl font-bold">{totalPincodes}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">Total pincodes active</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {cities.length === 0 && <p className="text-sm text-muted">No service cities yet. Add your first city.</p>}
        {cities.map((city) => (
          <div
            key={city.city_id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{city.city_name}</p>
              <p className="mt-1 text-xs text-muted">
                Currency: {city.currency ?? "Same as vendor default"} ({city.resolved_currency || "INR"})
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {city.pincodes.length === 0 ? (
                  <span className="text-xs text-muted">No pincodes yet</span>
                ) : (
                  city.pincodes.map((pin) => (
                    <span
                      key={pin}
                      className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-xs text-muted"
                    >
                      {pin}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-success">
                {city.pincodes.length} pincodes
              </span>
              <button type="button" className={ghostClass} onClick={() => setEditingCity(city)}>
                Edit pincodes
              </button>
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <span className="sr-only">City currency</span>
                <select
                  className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  value={city.currency ?? ""}
                  disabled={busy !== null}
                  onChange={(event) => {
                    const value = event.target.value;
                    void run(`currency-${city.city_id}`, async () => {
                      await marketplaceApi.updateServiceCity(
                        vendor.vendor_id,
                        city.city_id,
                        { currency: value === "" ? null : value },
                        ensureAccessToken,
                      );
                    });
                  }}
                >
                  <option value="">Same as vendor default</option>
                  {ALLOWED_CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={busy !== null}
                className={`${ghostClass} text-error`}
                onClick={() => {
                  if (!confirm(`Remove ${city.city_name} and unassign all products from it?`)) return;
                  void run(`delete-${city.city_id}`, async () => {
                    await marketplaceApi.deleteServiceCity(vendor.vendor_id, city.city_id, ensureAccessToken);
                  });
                }}
              >
                {busy === `delete-${city.city_id}` ? "Removing…" : "Remove city"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold">Product → Location assignment</h2>
        {unassignedCount > 0 && (
          <div className="mt-3 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-foreground">
            {unassignedCount} product{unassignedCount === 1 ? "" : "s"} have no location assigned and are invisible
            to customers.
          </div>
        )}
        {assignments.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No products yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Product</th>
                  <th className="px-3 py-2 font-semibold">Category</th>
                  <th className="px-3 py-2 font-semibold">Cities assigned</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {assignments.map((item) => (
                  <tr key={item.product_id} className="border-t border-border">
                    <td className="px-3 py-3 font-semibold">{item.product_name}</td>
                    <td className="px-3 py-3 text-muted">{item.category || "—"}</td>
                    <td className="px-3 py-3">
                      {item.cities.length === 0 ? (
                        <span className="rounded-full border border-error/30 bg-error/5 px-2 py-0.5 text-xs font-semibold text-error">
                          No location
                        </span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {item.cities.map((name) => (
                            <span
                              key={name}
                              className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-primary"
                            >
                              {name}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          item.cities.length > 0 ? "border-success/30 text-success" : "border-error/30 text-error"
                        }`}
                      >
                        {item.cities.length > 0 ? "Visible" : "Hidden"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button type="button" className={ghostClass} onClick={() => setAssignProduct(item)}>
                        Assign cities
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addingCity && (
        <AddCityDialog
          busy={busy === "add-city"}
          onClose={() => setAddingCity(false)}
          onSubmit={(cityName, currency) => {
            void run("add-city", async () => {
              await marketplaceApi.addServiceCity(
                vendor.vendor_id,
                { city_name: cityName, currency: currency || null },
                ensureAccessToken,
              );
              setAddingCity(false);
            });
          }}
        />
      )}

      {editingCity && (
        <EditPincodesDialog
          city={editingCity}
          busy={busy === `pins-${editingCity.city_id}`}
          onClose={() => setEditingCity(null)}
          onSubmit={(pincodes) => {
            void run(`pins-${editingCity.city_id}`, async () => {
              await marketplaceApi.setCityPincodes(
                vendor.vendor_id,
                editingCity.city_id,
                pincodes,
                ensureAccessToken,
              );
              setEditingCity(null);
            });
          }}
        />
      )}

      {assignProduct && (
        <AssignCitiesDialog
          product={assignProduct}
          cities={cities}
          busy={busy === `assign-${assignProduct.product_id}`}
          onClose={() => setAssignProduct(null)}
          onSubmit={(cityIds) => {
            void run(`assign-${assignProduct.product_id}`, async () => {
              await marketplaceApi.setProductServiceCities(assignProduct.product_id, cityIds, ensureAccessToken);
              setAssignProduct(null);
            });
          }}
        />
      )}
    </div>
  );
}

function AddCityDialog({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (cityName: string, currency: string) => void;
}) {
  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const cityName = String(data.get("city_name") ?? "").trim();
    if (!cityName) return;
    onSubmit(cityName, String(data.get("currency") ?? ""));
  }

  return (
    <Dialog title="Add city" onClose={onClose}>
      <form onSubmit={onFormSubmit} className="space-y-3">
        <label className="block text-xs font-semibold text-muted">
          City name
          <input name="city_name" required placeholder="e.g. Mumbai" className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-muted">
          Currency (optional)
          <select name="currency" defaultValue="" className={inputClass}>
            <option value="">Same as vendor default</option>
            {ALLOWED_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Adding…" : "Add city"}
        </button>
      </form>
    </Dialog>
  );
}

function EditPincodesDialog({
  city,
  busy,
  onClose,
  onSubmit,
}: {
  city: ServiceCityItem;
  busy: boolean;
  onClose: () => void;
  onSubmit: (pincodes: string[]) => void;
}) {
  const [raw, setRaw] = useState(city.pincodes.join(", "));

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(parsePincodes(raw));
  }

  return (
    <Dialog title={`Edit pincodes · ${city.city_name}`} onClose={onClose}>
      <form onSubmit={onFormSubmit} className="space-y-3">
        <label className="block text-xs font-semibold text-muted">
          Pincodes (comma or newline separated)
          <textarea
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            rows={6}
            placeholder="400001, 400002, 400003"
            className={inputClass}
          />
        </label>
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Saving…" : "Save pincodes"}
        </button>
      </form>
    </Dialog>
  );
}

function AssignCitiesDialog({
  product,
  cities,
  busy,
  onClose,
  onSubmit,
}: {
  product: ProductCityAssignmentItem;
  cities: ServiceCityItem[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (cityIds: string[]) => void;
}) {
  const cityNameToId = useMemo(
    () => Object.fromEntries(cities.map((city) => [city.city_name, city.city_id])),
    [cities],
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(product.cities.map((name) => cityNameToId[name]).filter(Boolean)),
  );

  function toggle(cityId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(cityId)) next.delete(cityId);
      else next.add(cityId);
      return next;
    });
  }

  return (
    <Dialog title={`Assign cities · ${product.product_name}`} onClose={onClose}>
      {cities.length === 0 ? (
        <p className="text-sm text-muted">Add service cities first before assigning products.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {cities.map((city) => (
              <label
                key={city.city_id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.has(city.city_id)}
                  onChange={() => toggle(city.city_id)}
                />
                {city.city_name}
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            className={buttonClass}
            onClick={() => onSubmit([...selected])}
          >
            {busy ? "Saving…" : "Save assignment"}
          </button>
        </div>
      )}
    </Dialog>
  );
}
