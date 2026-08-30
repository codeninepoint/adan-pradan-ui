"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/components/theme-provider";
import { THEMES } from "@/lib/themes";

type ThemePreferencesPanelProps = {
  open: boolean;
  onClose: () => void;
  profileAreaRef: React.RefObject<HTMLDivElement | null>;
};

export function ThemePreferencesPanel({
  open,
  onClose,
  profileAreaRef,
}: ThemePreferencesPanelProps) {
  const { theme, setTheme } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (profileAreaRef.current?.contains(target)) return;
      onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, onClose, profileAreaRef]);

  if (!open) return null;

  const vibgyorThemes = THEMES.filter((t) => t.group === "vibgyor");
  const neutralThemes = THEMES.filter((t) => t.group === "neutral");

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-surface p-4 shadow-lg"
      role="dialog"
      aria-label="Theme preferences"
    >
      <h2 className="text-sm font-semibold text-foreground">Theme Preferences</h2>

      <section className="mt-4">
        <p className="text-xs font-medium text-muted">VIBGYOR</p>
        <ul className="mt-2 flex flex-col gap-1">
          {vibgyorThemes.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setTheme(t.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-[var(--hero-tint)] ${
                  theme === t.id
                    ? "bg-[var(--hero-tint)] font-medium text-foreground"
                    : "text-foreground"
                }`}
                style={
                  theme === t.id
                    ? { boxShadow: `inset 0 0 0 2px ${t.color}` }
                    : undefined
                }
                aria-pressed={theme === t.id}
              >
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                {t.label}
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-xs font-medium text-muted">Neutral</p>
        <ul className="mt-2 flex flex-col gap-1">
          {neutralThemes.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setTheme(t.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-[var(--hero-tint)] ${
                  theme === t.id
                    ? "bg-[var(--hero-tint)] font-medium text-foreground"
                    : "text-foreground"
                }`}
                style={
                  theme === t.id
                    ? { boxShadow: `inset 0 0 0 2px ${t.color}` }
                    : undefined
                }
                aria-pressed={theme === t.id}
              >
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-border"
                  style={{
                    backgroundColor:
                      t.id === "light" ? "#FAFAFA" : "#09090B",
                  }}
                />
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
