import { describe, it, expect, beforeEach, vi } from "vitest";

const { jar, redirect, store } = vi.hoisted(() => ({
  jar: { value: undefined },
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  store: new Map(),
}));

vi.mock("@/lib/kv", () => ({
  kv: {
    get: async (key) => store.get(key) ?? null,
    mget: async (...keys) => keys.map((key) => store.get(key) ?? null),
    set: async (key, value, options) => {
      if (options?.nx && store.has(key)) return null;
      store.set(key, value);
      return "OK";
    },
    del: async (...keys) => keys.filter((key) => store.delete(key)).length,
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (jar.value === undefined ? undefined : { value: jar.value }),
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

process.env.SITE_PASSCODE = "env-passcode";

const { createSessionToken, setPasscode } = await import("@/lib/auth");
const { requireSession } = await import("@/lib/session");

beforeEach(() => {
  jar.value = undefined;
  redirect.mockClear();
  store.delete("authPasscode");
});

describe("requireSession", () => {
  it("sends a request with no cookie to /login", async () => {
    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("sends a session from before a passcode change to /login", async () => {
    jar.value = await createSessionToken();
    await setPasscode("new-passcode");
    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("lets a current session through", async () => {
    jar.value = await createSessionToken();
    await expect(requireSession()).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
