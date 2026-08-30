export const THEMES = [
  { id: "violet", label: "Violet", color: "#7C3AED", group: "vibgyor" },
  { id: "indigo", label: "Indigo", color: "#4F46E5", group: "vibgyor" },
  { id: "blue", label: "Blue", color: "#2563EB", group: "vibgyor" },
  { id: "green", label: "Green", color: "#16A34A", group: "vibgyor" },
  { id: "yellow", label: "Yellow", color: "#CA8A04", group: "vibgyor" },
  { id: "orange", label: "Orange", color: "#EA580C", group: "vibgyor" },
  { id: "red", label: "Red", color: "#DC2626", group: "vibgyor" },
  { id: "light", label: "Light", color: "#18181B", group: "neutral" },
  { id: "dark", label: "Dark", color: "#FAFAFA", group: "neutral" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "violet";

export const STORAGE_KEY = "adan-pradan-theme";

export const THEME_IDS = THEMES.map((t) => t.id);

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value);
}
