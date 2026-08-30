import { SectionHeading } from "@/components/landing/section-heading";
import { principles } from "@/lib/landing-content";

const accentClasses = {
  primary: "text-primary",
  secondary: "text-secondary",
  success: "text-success",
  warning: "text-warning",
} as const;

export function PrinciplesSection() {
  return (
    <section className="rounded-xl border border-border bg-surface p-6 sm:p-8">
      <SectionHeading title={principles.title} eyebrow="Governance" />

      <div className="mt-6 overflow-hidden overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-[var(--hero-tint)]">
              {principles.columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {principles.rows.map((row, index) => (
              <tr
                key={row.principle}
                className={`border-b border-border transition-colors last:border-b-0 hover:bg-[var(--hero-tint)] ${
                  index % 2 === 1 ? "bg-background/50" : ""
                }`}
              >
                <td
                  className={`px-4 py-3.5 font-bold ${accentClasses[row.accent]}`}
                >
                  {row.principle}
                </td>
                <td className="px-4 py-3.5 leading-relaxed text-muted">
                  {row.practice}
                </td>
                <td className="px-4 py-3.5 font-mono text-xs text-muted">
                  {row.mechanism}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
