import { describe, it, expect } from "vitest";
import { contrastTextColor, isHexColor } from "@/lib/color";

describe("contrastTextColor", () => {
  it("switches to dark text on light category fills so a chip never reads white on white", () => {
    expect(contrastTextColor("#eab308")).toBe("#1e293b");
    expect(contrastTextColor("#1E3A5F")).toBe("#ffffff");
  });
});

describe("isHexColor", () => {
  it("accepts six-digit hex codes in either case", () => {
    expect(isHexColor("#7b2132")).toBe(true);
    expect(isHexColor("#1E3A5F")).toBe(true);
  });

  // These values land in a <style> tag, so anything looser is an injection path.
  it("rejects shorthand, missing hash, and anything trailing", () => {
    expect(isHexColor("#fff")).toBe(false);
    expect(isHexColor("7b2132")).toBe(false);
    expect(isHexColor("#7b2132; }")).toBe(false);
    expect(isHexColor("")).toBe(false);
  });
});
