import { describe, it, expect } from "vitest";
import { pastDueMeetingDays, summarizeContacts } from "@/lib/contacts";

const contact = (overrides) => ({
  id: "c1",
  org: "Example Sorority",
  position: "Social Chair",
  status: "Not Reached Out",
  phone: "",
  meetingDate: null,
  notes: "",
  ...overrides,
});

const TODAY = "2026-09-14";

describe("pastDueMeetingDays", () => {
  it("counts the days since a meeting date that has already passed", () => {
    const row = contact({ status: "Responded/Meeting Set", meetingDate: "2026-09-02" });

    expect(pastDueMeetingDays(row, TODAY)).toBe(12);
  });

  it("stays quiet for a meeting set today or still upcoming", () => {
    const today = contact({ status: "Responded/Meeting Set", meetingDate: TODAY });
    const upcoming = contact({ status: "Responded/Meeting Set", meetingDate: "2026-09-20" });

    expect(pastDueMeetingDays(today, TODAY)).toBeNull();
    expect(pastDueMeetingDays(upcoming, TODAY)).toBeNull();
  });

  it("stays quiet when no meeting was ever set", () => {
    const row = contact({ status: "Responded/Meeting Set", meetingDate: null });

    expect(pastDueMeetingDays(row, TODAY)).toBeNull();
  });

  it("ignores a stale date on a contact that never got to the meeting stage", () => {
    // A date left behind on a contact that slid back to "Reached Out" isn't an
    // overdue meeting, it's leftover data — flagging it would cry wolf.
    const row = contact({ status: "Reached Out", meetingDate: "2026-09-02" });

    expect(pastDueMeetingDays(row, TODAY)).toBeNull();
  });
});

describe("summarizeContacts", () => {
  it("counts outstanding outreach by the state it is actually in", () => {
    const contacts = [
      contact({ id: "a" }),
      contact({ id: "b", status: "Reached Out" }),
      contact({ id: "c", status: "Reached Out" }),
      contact({ id: "d", status: "Responded/Meeting Set", meetingDate: "2026-09-02" }),
      contact({ id: "e", status: "Responded/Meeting Set", meetingDate: "2026-09-30" }),
    ];

    expect(summarizeContacts(contacts, TODAY)).toEqual({
      notReachedOut: 1,
      awaitingReply: 2,
      meetingPassed: 1,
    });
  });

  it("treats a contact with no status set as not reached out", () => {
    // Rows saved before status existed, and brand-new blank rows, both land
    // here — counting them as "done" would undercount the real work left.
    expect(summarizeContacts([contact({ status: undefined })], TODAY).notReachedOut).toBe(1);
  });

  it("reports all zeroes for an empty semester", () => {
    expect(summarizeContacts([], TODAY)).toEqual({
      notReachedOut: 0,
      awaitingReply: 0,
      meetingPassed: 0,
    });
  });
});
