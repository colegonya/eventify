import { describe, it, expect } from "vitest";
import { centsToDollarsInput, dollarsToCents, parseDollarsToCents } from "@/lib/money";

describe("centsToDollarsInput", () => {
  it("always shows two decimal places", () => {
    expect(centsToDollarsInput(150000)).toBe("1500.00");
    expect(centsToDollarsInput(5)).toBe("0.05");
    expect(centsToDollarsInput(0)).toBe("0.00");
  });

  it("shows an empty field for a figure that was never entered", () => {
    // Null is "no number here", which has to render as a blank input rather
    // than a misleading 0.00 the officer never typed.
    expect(centsToDollarsInput(null)).toBe("");
  });
});

describe("dollarsToCents", () => {
  it("converts dollars to whole cents", () => {
    expect(dollarsToCents("1500")).toBe(150000);
    expect(dollarsToCents("12.34")).toBe(1234);
  });

  it("rounds rather than truncating a sub-cent amount", () => {
    expect(dollarsToCents("0.005")).toBe(1);
    expect(dollarsToCents("10.994")).toBe(1099);
  });

  it("treats a half-typed or empty field as zero", () => {
    // This one feeds the live headroom preview while someone is still typing,
    // so an unparseable value has to be a number, not null: the running total
    // under the cursor should hold at zero, not blank out mid-keystroke.
    expect(dollarsToCents("")).toBe(0);
    expect(dollarsToCents(".")).toBe(0);
    expect(dollarsToCents("abc")).toBe(0);
  });
});

describe("parseDollarsToCents", () => {
  it("converts a submitted dollar string to cents", () => {
    expect(parseDollarsToCents("1500")).toBe(150000);
    expect(parseDollarsToCents("12.34")).toBe(1234);
    expect(parseDollarsToCents("0")).toBe(0);
  });

  it("keeps a blank field null instead of storing a zero nobody entered", () => {
    // The whole point of the split from dollarsToCents: a null expected spend
    // marks an event as having no budget figure at all, which the Budget page
    // reads differently from one deliberately set to $0.
    expect(parseDollarsToCents("")).toBeNull();
    expect(parseDollarsToCents("   ")).toBeNull();
    expect(parseDollarsToCents(null)).toBeNull();
    expect(parseDollarsToCents(undefined)).toBeNull();
  });

  it("returns null for a value that isn't a number at all", () => {
    expect(parseDollarsToCents("abc")).toBeNull();
  });

  it("keeps a negative amount, which is how a refund gets recorded", () => {
    expect(parseDollarsToCents("-25.50")).toBe(-2550);
  });

  it("takes the leading number from a fat-fingered entry rather than rejecting it", () => {
    // parseFloat stops at the first invalid character, so "12abc" is 12.
    // Pinning it here so the behavior is a decision rather than a surprise:
    // the field is type=number in every form that feeds it, so reaching this
    // means something already went unusual.
    expect(parseDollarsToCents("12abc")).toBe(1200);
  });
});
