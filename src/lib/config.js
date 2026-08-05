// Deploy-time *defaults* for a chapter's branding. These are the starting
// point, not the source of truth: whatever the chapter later saves on the
// Settings page is stored in Redis and wins over anything here, so renaming or
// recoloring never means a trip to the Vercel dashboard and a redeploy. See
// getBrandingSettings() in data.js for the merge.
export const DEFAULT_CHAPTER_NAME =
  process.env.NEXT_PUBLIC_CHAPTER_NAME?.trim() || "Blank";

export const appTitle = (chapterName) => `${chapterName} Social Calendar`;

// Unset by default, so every deployment gets the generic palette from
// globals.css until a chapter picks its own — one shared codebase serves both
// the public template and a chapter's branded instance without the two
// fighting over defaults.
export const BRAND_COLOR_VARS = [
  ["--color-brand-primary", "primary", "Primary"],
  ["--color-brand-accent", "accent", "Accent"],
  ["--color-brand-accent-deep", "accentDeep", "Accent (deep)"],
  ["--color-brand-ink", "ink", "Text"],
];

// Mirrors --color-brand-primary's default in globals.css. A chapter's primary
// can be any hex, including a light one that white text would fail against —
// this is the fallback layout.jsx computes contrast from when a chapter
// hasn't overridden it.
export const DEFAULT_BRAND_PRIMARY_HEX = "#1e3a5f";

export const DEFAULT_BRAND_COLORS = {
  primary: process.env.NEXT_PUBLIC_BRAND_PRIMARY,
  accent: process.env.NEXT_PUBLIC_BRAND_ACCENT,
  accentDeep: process.env.NEXT_PUBLIC_BRAND_ACCENT_DEEP,
  ink: process.env.NEXT_PUBLIC_BRAND_INK,
};
