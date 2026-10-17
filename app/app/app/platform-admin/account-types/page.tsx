export default function AccountTypesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Account Types</h1>
      <p className="mt-1 text-sm text-muted">
        Reference model for human users, service accounts, lifecycle states, and tenant upgrade paths.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">User Account</h2>
          <p className="mt-2 text-sm text-muted">
            Human-operated account. Signs in via email/password (and OAuth where enabled). Subject to MFA,
            session limits, and email verification.
          </p>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {[
                ["Auth method", "Email/password, OAuth, OTP"],
                ["MFA", "Optional (mandatory for operators)"],
                ["Session TTL", "8 hours (configurable)"],
                ["Email verification", "Required before first login"],
                ["Can hold role", "Customer → Vendor Admin → Tenant Admin"],
                ["First user", "Auto-assigned platform operator"],
              ].map(([k, v]) => (
                <tr key={k} className="border-t border-border/60">
                  <td className="py-2 pr-3 text-muted">{k}</td>
                  <td className="py-2 font-medium">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Service Account</h2>
          <p className="mt-2 text-sm text-muted">
            Non-human identity for integrations, plugins, bots, and jobs. API key + HMAC auth only — no
            password login.
          </p>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {[
                ["Auth method", "API key + HMAC-SHA256"],
                ["MFA", "Not applicable"],
                ["Key rotation", "30 / 90 day cycles"],
                ["Key count", "Up to 5 active keys"],
                ["Scope", "Plugin or integration scoped"],
                ["Created by", "Tenant Admin or Platform Admin"],
              ].map(([k, v]) => (
                <tr key={k} className="border-t border-border/60">
                  <td className="py-2 pr-3 text-muted">{k}</td>
                  <td className="py-2 font-medium">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Tenant upgrade paths</h2>
          <p className="mt-2 text-sm text-muted">
            Every new signup starts as an Individual tenant. Organisation and Vendor upgrades unlock team
            and selling capabilities.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
            <li>
              <strong>Individual</strong> — default on signup; marketplace purchasing.
            </li>
            <li>
              <strong>Organisation</strong> — add members, org-scoped plugins, shared address book.
            </li>
            <li>
              <strong>Vendor</strong> — KYC + GST + bank details; list products and use plugins.
            </li>
          </ol>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Account lifecycle states</h2>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted">
                <th className="py-1">State</th>
                <th className="py-1">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Pending", "Email not verified"],
                ["Active", "Normal operation"],
                ["Suspended / Locked", "Access blocked; data intact"],
                ["Blocked", "Permanent ban; cannot re-register"],
                ["Under Review", "KYC / compliance in progress"],
              ].map(([state, meaning]) => (
                <tr key={state} className="border-t border-border/60">
                  <td className="py-2 pr-3 font-medium">{state}</td>
                  <td className="py-2 text-muted">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
