import { describe, it, expect, vi } from "vitest";

// Every export of actions.js is a public POST endpoint: Next.js runs any
// server action posted to any page, including /login, which the proxy leaves
// open. This walks every export rather than a hand-kept list, so an action
// added later without requireSession() fails here instead of shipping.

const { dataCalls } = vi.hoisted(() => ({ dataCalls: [] }));

vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(async () => {
    throw new Error("NO_SESSION");
  }),
}));

// Any function the actions reach for in data.js records the call. None
// should run once the session check has refused the request.
vi.mock("@/lib/data", () => {
  const fns = new Map();
  return new Proxy(
    {},
    {
      has: (_target, key) => typeof key === "string",
      get: (_target, key) => {
        if (typeof key !== "string" || key === "then") return undefined;
        if (!fns.has(key)) fns.set(key, vi.fn(async () => dataCalls.push(key)));
        return fns.get(key);
      },
    },
  );
});
vi.mock("@/lib/kv", () => ({ kv: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

process.env.SITE_PASSCODE = "env-passcode";

const actions = await import("@/lib/actions");

describe("server actions without a session", () => {
  const names = Object.keys(actions).filter((name) => typeof actions[name] === "function");

  it("finds the actions to check", () => {
    expect(names).toContain("updatePasscodeAction");
    expect(names).toContain("saveEventAction");
    expect(names).not.toContain("loginAction");
  });

  it.each(names)("%s refuses before touching any data", async (name) => {
    dataCalls.length = 0;
    const form = new FormData();
    form.set("passcode", "outsider1");
    form.set("passcodeConfirm", "outsider1");
    await expect(actions[name](form, "semester", "event", "2026-01-01", "2026-01-02")).rejects.toThrow(
      "NO_SESSION",
    );
    expect(dataCalls).toEqual([]);
  });
});
