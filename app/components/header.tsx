"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ProfileMenu } from "@/components/profile-menu";
import { ThemePreferencesPanel } from "@/components/theme-preferences-panel";
import { initialsFromName } from "@/lib/session";

const HOVER_CLOSE_DELAY_MS = 150;

export function Header() {
  const router = useRouter();
  const { ready, signedIn, profile, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const profileAreaRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initials = profile?.display_name
    ? initialsFromName(profile.display_name)
    : "AP";

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (themePanelOpen) return;
    clearCloseTimeout();
    setProfileOpen(true);
  }, [clearCloseTimeout, themePanelOpen]);

  const handleMouseLeave = useCallback(() => {
    if (themePanelOpen) return;
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setProfileOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearCloseTimeout, themePanelOpen]);

  const handleAvatarClick = useCallback(() => {
    if (window.matchMedia("(pointer: coarse)").matches) {
      if (themePanelOpen) return;
      setProfileOpen((prev) => !prev);
    }
  }, [themePanelOpen]);

  const openThemePanel = useCallback(() => {
    setProfileOpen(false);
    setThemePanelOpen(true);
  }, []);

  const closeThemePanel = useCallback(() => {
    setThemePanelOpen(false);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setProfileOpen(false);
    router.push("/login");
  }, [signOut, router]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (themePanelOpen) {
        closeThemePanel();
      } else if (profileOpen) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [themePanelOpen, profileOpen, closeThemePanel]);

  useEffect(() => {
    return () => clearCloseTimeout();
  }, [clearCloseTimeout]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
        <Link href={signedIn ? "/app" : "/"} className="text-lg font-bold tracking-tight text-primary">
          Adan Pradan
        </Link>

        <div className="flex-1" />

        {!ready ? (
          <div className="h-9 w-20 animate-pulse rounded-full bg-border/60" />
        ) : !signedIn ? (
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-foreground transition-colors hover:text-primary"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Create account
            </Link>
          </div>
        ) : (
          <div
            ref={profileAreaRef}
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <ThemePreferencesPanel
              open={themePanelOpen}
              onClose={closeThemePanel}
              profileAreaRef={profileAreaRef}
            />

            <button
              ref={triggerRef}
              type="button"
              onClick={handleAvatarClick}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-sm font-semibold text-foreground transition-colors hover:bg-[var(--hero-tint)]"
              aria-label="Open profile menu"
              aria-haspopup="menu"
              aria-expanded={profileOpen || themePanelOpen}
              title={profile?.email}
            >
              {initials}
            </button>

            <ProfileMenu
              open={profileOpen && !themePanelOpen}
              onThemePreferencesClick={openThemePanel}
              onSignOut={handleSignOut}
            />
          </div>
        )}
      </div>
    </header>
  );
}
