import { describe, it, expect } from "vitest";
import { normalizeMarker, normalizeMarkers, sortMarkers } from "@/lib/markers";

describe("normalizeMarker", () => {
  it("reads a marker written in the current shape", () => {
    const marker = normalizeMarker({
      id: "m1",
      semesterId: "fall-2026",
      date: "2026-10-11",
      label: "Homecoming",
    });

    expect(marker).toEqual({
      id: "m1",
      semesterId: "fall-2026",
      date: "2026-10-11",
      label: "Homecoming",
    });
  });

  it("renders a pre-existing game day exactly as it already displayed", () => {
    // These records are live in production. The calendar rendered them as
    // "vs. {opponent}", so reading them back to that same string is what makes
    // this a lazy migration instead of a data change.
    const marker = normalizeMarker({
      id: "gd-1",
      semesterId: "fall-2026",
      date: "2026-10-11",
      opponent: "Rival State",
    });

    expect(marker.label).toBe("vs. Rival State");
  });

  it("prefers a real label over a leftover opponent on the same record", () => {
    // A record edited through the new editor keeps its old field until it is
    // next written; the new value has to win in the meantime.
    const marker = normalizeMarker({ id: "m1", date: "2026-10-11", label: "Parents Weekend", opponent: "Rival State" });

    expect(marker.label).toBe("Parents Weekend");
  });

  it("yields an empty label when there is nothing to show", () => {
    expect(normalizeMarker({ id: "m1", date: "2026-10-11" }).label).toBe("");
    expect(normalizeMarker({ id: "m1", date: "2026-10-11", opponent: "   " }).label).toBe("");
  });
});

describe("normalizeMarkers", () => {
  it("converts a mixed list of old and new records", () => {
    const list = normalizeMarkers([
      { id: "a", date: "2026-09-06", opponent: "Example University" },
      { id: "b", date: "2026-10-11", label: "Finals week" },
    ]);

    expect(list.map((m) => m.label)).toEqual(["vs. Example University", "Finals week"]);
  });

  it("drops records with no date or no label rather than rendering a blank chip", () => {
    const list = normalizeMarkers([
      { id: "a", date: "2026-09-06", label: "Real" },
      { id: "b", date: "", label: "No date" },
      { id: "c", date: "2026-09-07", label: "   " },
    ]);

    expect(list.map((m) => m.id)).toEqual(["a"]);
  });

  it("handles a semester that has none", () => {
    expect(normalizeMarkers([])).toEqual([]);
    expect(normalizeMarkers(undefined)).toEqual([]);
  });
});

describe("sortMarkers", () => {
  it("orders chronologically without mutating the input", () => {
    const input = [
      { id: "b", date: "2026-10-11", label: "Later" },
      { id: "a", date: "2026-09-06", label: "Earlier" },
    ];

    expect(sortMarkers(input).map((m) => m.id)).toEqual(["a", "b"]);
    expect(input.map((m) => m.id)).toEqual(["b", "a"]);
  });
});
