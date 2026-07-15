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

// The app renders one signature dark theme regardless of OS preference (see
// index.css / index.html), so only the dark chrome values are used - the
// light ones above stay only as the source-of-truth reference from the
// dataviz skill's validated palette, in case a light mode is ever added back.
export const CHROME = {
  surface: "#1a1a19",
  primaryInk: "#ffffff",
  secondaryInk: "#c3c2b7",
  mutedInk: "#898781",
  gridline: "#2c2c2a",
  baseline: "#383835",
};

export function categoricalColor(index: number): string {
  return CATEGORICAL_DARK[index % CATEGORICAL_DARK.length];
}
