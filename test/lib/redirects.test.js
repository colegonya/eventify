import { describe, it, expect } from "vitest";
import { safeNextPath } from "@/lib/redirects";

describe("safeNextPath", () => {
  it("keeps a same-site path with its query and hash", () => {
    expect(safeNextPath("/budget?semester=fall-2026#equipment")).toBe(
      "/budget?semester=fall-2026#equipment",
    );
  });

  it("falls back for anything a browser would send to another host", () => {
    for (const next of [
      "https://evil.example/phish",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "calendar",
    ]) {
      expect(safeNextPath(next)).toBe("/calendar");
    }
  });

  it("falls back when next is missing or not a string", () => {
    expect(safeNextPath(undefined)).toBe("/calendar");
    expect(safeNextPath("")).toBe("/calendar");
    expect(safeNextPath(["/budget"])).toBe("/calendar");
  });

  it("uses the fallback it's given", () => {
    expect(safeNextPath("//evil.example", "/settings")).toBe("/settings");
  });
});
