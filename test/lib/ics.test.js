import { describe, it, expect } from "vitest";
import { buildICS } from "@/lib/ics";

const categoriesById = new Map([
  ["mixer", { id: "mixer", label: "Mixer", isOtherOrgCategory: false }],
  ["other", { id: "other", label: "Other Org Event", isOtherOrgCategory: true }],
]);

const event = (overrides) => ({
  id: "e1",
  name: "Fall Mixer",
  category: "mixer",
  host: "Pike",
  startDate: "2026-10-24",
  endDate: "2026-10-24",
  startTime: null,
  endTime: null,
  status: "confirmed",
  notes: "",
  ...overrides,
});

const build = (events) => buildICS(events, "Fall 2026", categoriesById, "Pike");
const lineOf = (ics, prefix) =>
  ics.split("\r\n").find((l) => l.startsWith(prefix));

describe("buildICS", () => {
  it("leaves out events the chapter isn't hosting", () => {
    const ics = build([
      event({ id: "ours" }),
      event({ id: "theirs", category: "other", name: "Their Formal" }),
    ]);

    expect(ics).toContain("UID:ours@social-calendar");
    expect(ics).not.toContain("Their Formal");
  });

  it("writes a day-only event as a DATE range ending the next day", () => {
    // DTEND is exclusive for all-day events, so a one-day event ends on the
    // 25th. Writing the 24th would make it vanish from most calendar clients.
    const ics = build([event()]);

    expect(lineOf(ics, "DTSTART;VALUE=DATE:")).toBe("DTSTART;VALUE=DATE:20261024");
    expect(lineOf(ics, "DTEND;VALUE=DATE:")).toBe("DTEND;VALUE=DATE:20261025");
  });

  it("rolls DTEND past midnight rather than emitting a negative duration", () => {
    const ics = build([event({ startTime: "22:00", endTime: "00:30" })]);

    expect(lineOf(ics, "DTSTART:")).toBe("DTSTART:20261024T220000");
    // Same calendar date in, next date out: a VEVENT whose end precedes its
    // start gets rejected or mis-rendered on import.
    expect(lineOf(ics, "DTEND:")).toBe("DTEND:20261025T003000");
  });

  it("gives a start-time-only event the default duration", () => {
    const ics = build([event({ startTime: "21:00" })]);

    expect(lineOf(ics, "DTEND:")).toBe("DTEND:20261025T000000");
  });

  it("escapes the characters that would otherwise break a field in two", () => {
    const ics = build([
      event({ name: "Formal; black tie, fancy", notes: "line one\nline two" }),
    ]);

    expect(lineOf(ics, "SUMMARY:")).toBe("SUMMARY:Formal\\; black tie\\, fancy");
    expect(ics).toContain("line one\\nline two");
  });

  it("keeps an emoji intact when it lands on a fold boundary", () => {
    // Folding slices by UTF-16 code unit while measuring UTF-8 bytes, so a
    // surrogate pair straddling the 75-octet limit can be cut in half. Each
    // half then encodes as U+FFFD and the emoji is silently destroyed. The
    // padding below puts the pair exactly on that boundary.
    const name = `${"A".repeat(64)}🎉${"B".repeat(20)}`;
    const ics = build([event({ name })]);

    const roundTripped = Buffer.from(ics, "utf8").toString("utf8");
    expect(roundTripped).not.toContain("�");
    expect(roundTripped).toContain("🎉");
  });

  it("folds a long line at the octet limit with a leading-space continuation", () => {
    const ics = build([event({ name: "A".repeat(200) })]);

    for (const line of ics.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
    expect(ics).toContain("\r\n ");
  });

  it("marks a tentative event TENTATIVE and a confirmed one CONFIRMED", () => {
    expect(build([event()])).toContain("STATUS:CONFIRMED");
    expect(build([event({ status: "tentative" })])).toContain("STATUS:TENTATIVE");
  });
});
