import { useState } from "react";
import { applyTheme, getStoredTheme, type ThemeId } from "../lib/theme";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(getStoredTheme);

  const setTheme = (themeId: ThemeId) => {
    applyTheme(themeId);
    setThemeState(themeId);
  };

  return { theme, setTheme };
}
