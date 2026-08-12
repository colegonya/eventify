import { describe, it, expect } from "vitest";
import { contrastTextColor } from "@/lib/color";

describe("contrastTextColor", () => {
  it("switches to dark text on light category fills so a chip never reads white on white", () => {
    expect(contrastTextColor("#eab308")).toBe("#1e293b");
    expect(contrastTextColor("#1E3A5F")).toBe("#ffffff");
  });
});
