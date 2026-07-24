// The one place a chapter names itself. Set NEXT_PUBLIC_CHAPTER_NAME in your
// environment; until then everything reads as a placeholder so it's obvious
// setup isn't finished yet.
export const CHAPTER_NAME = process.env.NEXT_PUBLIC_CHAPTER_NAME?.trim() || "Blank";

export const APP_TITLE = `${CHAPTER_NAME} Social Calendar`;
