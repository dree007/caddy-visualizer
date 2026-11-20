/**
 * UI designs. Both share structure and behaviour; only tokens and a few
 * `schematic:` utility variants (see globals.css) change the look.
 * Light/dark (next-themes) is independent of the design.
 */
export const DESIGNS = ["classic", "schematic"] as const;
export type Design = (typeof DESIGNS)[number];
/** Existing installations keep their look until somebody switches. */
export const DEFAULT_DESIGN: Design = "classic";
export const DESIGN_COOKIE = "cv_design";

export function isDesign(value: unknown): value is Design {
  return DESIGNS.includes(value as Design);
}

/** Unknown or missing cookie values fall back to the default design. */
export function resolveDesign(cookie: string | undefined | null): Design {
  return isDesign(cookie) ? cookie : DEFAULT_DESIGN;
}

/** Browser UI colour per design and colour scheme (`<meta name="theme-color">`). */
export const THEME_COLORS: Record<Design, { light: string; dark: string }> = {
  classic: { light: "#f5f0e7", dark: "#25211c" },
  schematic: { light: "#edf1f5", dark: "#0b1724" },
};
