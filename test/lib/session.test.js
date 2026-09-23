import { describe, it, expect, beforeEach, vi } from "vitest";

const { jar, redirect } = vi.hoisted(() => ({
  jar: { value: undefined },
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/lib/kv", () => ({ kv: { get: async () => null } }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (jar.value === undefined ? undefined : { value: jar.value }),
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

process.env.SITE_PASSCODE = "env-passcode";

const { hashPasscode } = await import("@/lib/auth");
const { requireSession } = await import("@/lib/session");

beforeEach(() => {
  jar.value = undefined;
  redirect.mockClear();
});

describe("requireSession", () => {
  it("sends a request with no cookie to /login", async () => {
    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("sends a cookie minted from a different passcode to /login", async () => {
    jar.value = hashPasscode("old-passcode");
    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("lets a cookie for the current passcode through", async () => {
    jar.value = hashPasscode("env-passcode");
    await expect(requireSession()).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
