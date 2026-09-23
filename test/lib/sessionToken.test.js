import { describe, it, expect } from "vitest";
import { readSessionToken, signSessionToken } from "@/lib/sessionToken";

const key = Buffer.alloc(32, 7);
const otherKey = Buffer.alloc(32, 8);
const claims = { pv: "v3", iat: 1_000, exp: 2_000 };

describe("session tokens", () => {
  it("reads back the claims it signed while unexpired", () => {
    expect(readSessionToken(signSessionToken(claims, key), key, 1_500)).toEqual(claims);
  });

  it("rejects a token at or after its expiry", () => {
    const token = signSessionToken(claims, key);
    expect(readSessionToken(token, key, 2_000)).toBeNull();
    expect(readSessionToken(token, key, 9_999)).toBeNull();
  });

  it("rejects a token signed with a different key", () => {
    expect(readSessionToken(signSessionToken(claims, otherKey), key, 1_500)).toBeNull();
  });

  it("rejects edited claims, such as a pushed-out expiry, even with the old signature", () => {
    const [, signature] = signSessionToken(claims, key).split(".");
    const forged = Buffer.from(JSON.stringify({ ...claims, exp: 99_999 })).toString("base64url");
    expect(readSessionToken(`${forged}.${signature}`, key, 1_500)).toBeNull();
  });

  it("rejects anything that isn't a token", () => {
    for (const token of [
      undefined,
      null,
      "",
      "abc",
      "a.b",
      "a.b.c",
      // A legacy cookie: the SHA-256 hex of a passcode.
      "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
    ]) {
      expect(readSessionToken(token, key, 1_500)).toBeNull();
    }
  });

  it("rejects a correctly signed body that isn't valid claims", () => {
    const body = Buffer.from("not json").toString("base64url");
    const token = signSessionToken({}, key).replace(/^[^.]+/, body);
    expect(readSessionToken(token, key, 1_500)).toBeNull();
    expect(readSessionToken(signSessionToken({ pv: "v1" }, key), key, 1_500)).toBeNull();
  });
});
