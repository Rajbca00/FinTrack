// Keeps the theme selector's class on <html> in sync with the chosen theme
// and persists the choice. `.dark` gates every component's existing
// `dark:`-prefixed utility class (see index.css and the sweep in commit
// history) - it's applied alongside the theme-* class for the two dark
// themes, and omitted for Daylight so those components fall back to their
// original light styling automatically.
export type ThemeId = "midnight" | "classic-blue" | "daylight";

export const THEMES: { id: ThemeId; name: string; description: string; swatch: { page: string; surface: string; brand: string; ink: string } }[] = [
  {
    id: "midnight",
    name: "Midnight",
    description: "The original near-black theme with a soft blue accent.",
    swatch: { page: "#0d0d0d", surface: "#1a1a19", brand: "#3987e5", ink: "#ffffff" },
  },
  {
    id: "classic-blue",
    name: "Classic Blue",
    description: "A lighter charcoal with a bolder, more saturated royal blue.",
    swatch: { page: "#161a23", surface: "#1f2530", brand: "#2f6fed", ink: "#eef1f7" },
  },
  {
    id: "daylight",
    name: "Daylight",
    description: "A bright, true light theme.",
    swatch: { page: "#f4f6f9", surface: "#ffffff", brand: "#2f6fed", ink: "#12151c" },
  },
];

const STORAGE_KEY = "fintrack.theme";
const DEFAULT_THEME: ThemeId = "midnight";
const DARK_THEMES: ThemeId[] = ["midnight", "classic-blue"];

export function getStoredTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && THEMES.some((t) => t.id === raw)) return raw as ThemeId;
  } catch {
    // ignore - fall back to default
  }
  return DEFAULT_THEME;
}

export function applyTheme(themeId: ThemeId) {
  const root = document.documentElement;
  root.className = DARK_THEMES.includes(themeId) ? `dark theme-${themeId}` : `theme-${themeId}`;

  const themeColor = THEMES.find((t) => t.id === themeId)?.swatch.page;
  if (themeColor) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
  }

  try {
    localStorage.setItem(STORAGE_KEY, themeId);
  } catch {
    // ignore - theme just won't persist this time
  }
}
