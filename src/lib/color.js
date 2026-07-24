// Categories carry an arbitrary chapter-chosen background color, so chip/swatch
// text color can't be hand-picked per color the way the old fixed Tailwind
// palette allowed. This picks white or near-black by perceived luminance so
// text stays readable against whatever color a chapter picks.
export function contrastTextColor(hex) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.6 ? "#1e293b" : "#ffffff";
}
