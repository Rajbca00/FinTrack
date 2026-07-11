// Validated categorical palette (fixed hue order - never reassign by rank).
// Source: dataviz skill reference palette. Light/dark steps both pre-validated
// for CVD-safe adjacent contrast, so no re-validation needed here.
export const CATEGORICAL_LIGHT = [
  "#2a78d6", // blue
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
  "#e87ba4", // magenta
  "#eb6834", // orange
];

export const CATEGORICAL_DARK = [
  "#3987e5",
  "#199e70",
  "#c98500",
  "#008300",
  "#9085e9",
  "#e66767",
  "#d55181",
  "#d95926",
];

export const DIVERGING = {
  light: { positive: "#2a78d6", negative: "#e34948", mid: "#f0efec" },
  dark: { positive: "#3987e5", negative: "#e66767", mid: "#383835" },
};

export const CHROME = {
  light: {
    surface: "#fcfcfb",
    primaryInk: "#0b0b0b",
    secondaryInk: "#52514e",
    mutedInk: "#898781",
    gridline: "#e1e0d9",
    baseline: "#c3c2b7",
  },
  dark: {
    surface: "#1a1a19",
    primaryInk: "#ffffff",
    secondaryInk: "#c3c2b7",
    mutedInk: "#898781",
    gridline: "#2c2c2a",
    baseline: "#383835",
  },
};

import { useEffect, useState } from "react";

export function useIsDarkMode(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => setDark(e.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, []);
  return dark;
}

export function categoricalColor(index: number, dark: boolean): string {
  const arr = dark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
  return arr[index % arr.length];
}
