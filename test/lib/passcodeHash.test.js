import { describe, it, expect } from "vitest";
import { hashPasscode, verifyPasscodeHash } from "@/lib/passcodeHash";

describe("passcode hashing", () => {
  it("verifies the passcode it hashed and rejects any other", async () => {
    const stored = await hashPasscode("hunter22");
    expect(await verifyPasscodeHash("hunter22", stored)).toBe(true);
    expect(await verifyPasscodeHash("hunter23", stored)).toBe(false);
    expect(await verifyPasscodeHash("", stored)).toBe(false);
  });

  it("salts every hash, so the same passcode never stores the same value twice", async () => {
    const [a, b] = await Promise.all([hashPasscode("same-code"), hashPasscode("same-code")]);
    expect(a).not.toBe(b);
    expect(await verifyPasscodeHash("same-code", a)).toBe(true);
    expect(await verifyPasscodeHash("same-code", b)).toBe(true);
  });

  it("stores scrypt with its parameters, and nothing resembling the passcode", async () => {
    const stored = await hashPasscode("hunter22");
    expect(stored).toMatch(/^scrypt\$32768\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(stored).not.toContain("hunter22");
  });

  it("rejects malformed or foreign stored values instead of throwing", async () => {
    for (const stored of [
      undefined,
      null,
      "",
      "not-a-hash",
      "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8", // plain SHA-256
      "scrypt$x$8$1$c2FsdA$a2V5",
      "scrypt$32768$8$1$$a2V5",
      "bcrypt$32768$8$1$c2FsdA$a2V5",
    ]) {
      expect(await verifyPasscodeHash("password", stored)).toBe(false);
    }
  });
});
