"use client";

type ProfileMenuProps = {
  open: boolean;
  onThemePreferencesClick: () => void;
};

const MENU_LINKS = [
  { label: "Orders", href: "#" },
  { label: "Wishlist", href: "#" },
  { label: "Contact Us", href: "#" },
  { label: "Your Account", href: "#" },
] as const;

export function ProfileMenu({
  open,
  onThemePreferencesClick,
}: ProfileMenuProps) {
  if (!open) return null;

  return (
    <div
      className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-border bg-surface py-1 shadow-lg"
      role="menu"
      aria-label="Profile menu"
    >
      <ul>
        {MENU_LINKS.map((item) => (
          <li key={item.label} role="none">
            <a
              href={item.href}
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-[var(--hero-tint)]"
            >
              {item.label}
            </a>
          </li>
        ))}
        <li role="none" className="my-1 border-t border-border" />
        <li role="none">
          <button
            type="button"
            role="menuitem"
            onClick={onThemePreferencesClick}
            className="block w-full px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-[var(--hero-tint)]"
          >
            Set Theme Preferences
          </button>
        </li>
      </ul>
    </div>
  );
}
