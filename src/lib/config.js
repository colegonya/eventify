// The one place a chapter names itself. Set NEXT_PUBLIC_CHAPTER_NAME in your
// environment; until then everything reads as a placeholder so it's obvious
// setup isn't finished yet.
export const CHAPTER_NAME = process.env.NEXT_PUBLIC_CHAPTER_NAME?.trim() || "Blank";

export const APP_TITLE = `${CHAPTER_NAME} Social Calendar`;

// Optional per-deployment brand color overrides. Unset by default, so every
// deployment gets the same generic palette from globals.css until a chapter
// sets these — lets one shared codebase serve both the public template and a
// chapter's own real, branded instance without the two fighting over defaults.
export const BRAND_COLOR_OVERRIDES = {
  "--color-brand-primary": process.env.NEXT_PUBLIC_BRAND_PRIMARY,
  "--color-brand-accent": process.env.NEXT_PUBLIC_BRAND_ACCENT,
  "--color-brand-accent-deep": process.env.NEXT_PUBLIC_BRAND_ACCENT_DEEP,
  "--color-brand-ink": process.env.NEXT_PUBLIC_BRAND_INK,
};
