"use client";

import { useRef, useState } from "react";
import { SettingsPanel } from "@/components/settings-panel";

export function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center px-4 sm:px-6">
        <span className="text-lg font-bold tracking-tight text-primary">
          Adan Pradan
        </span>

        <div className="flex-1" />

        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setSettingsOpen((prev) => !prev)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-sm font-semibold text-foreground transition-colors hover:bg-[var(--hero-tint)]"
            aria-label="Open settings"
            aria-expanded={settingsOpen}
          >
            AP
          </button>

          <SettingsPanel
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            triggerRef={triggerRef}
          />
        </div>
      </div>
    </header>
  );
}
