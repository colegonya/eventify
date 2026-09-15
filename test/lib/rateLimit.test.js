import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted so the vi.mock factory below (which runs before imports) can close
// over them. The fake stands in for Upstash's INCR/EXPIRE/GET/DEL only.
const { store, expire } = vi.hoisted(() => ({ store: new Map(), expire: vi.fn() }));

vi.mock("@/lib/kv", () => ({
  kv: {
    get: async (key) => store.get(key) ?? null,
    incr: async (key) => {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    },
    expire,
    del: async (key) => {
      store.delete(key);
    },
  },
}));

const {
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_SECONDS,
  clientIdFromForwardedFor,
  isLoginLockedOut,
  registerFailedLogin,
  clearFailedLogins,
} = await import("@/lib/rateLimit");

beforeEach(() => {
  store.clear();
  expire.mockClear();
});

describe("clientIdFromForwardedFor", () => {
  it("counts against the original client, not the proxy that forwarded it", () => {
    expect(clientIdFromForwardedFor("203.0.113.7, 70.41.3.18, 150.172.238.178")).toBe("203.0.113.7");
  });

  it("falls back to one shared bucket when no header is present", () => {
    // Stricter than skipping the limit: every header-less request shares a
    // single counter rather than each getting an unlimited one of its own.
    expect(clientIdFromForwardedFor(null)).toBe("unknown");
    expect(clientIdFromForwardedFor("   ")).toBe("unknown");
  });
});

describe("login attempt limiting", () => {
  it("allows a fresh client through", async () => {
    expect(await isLoginLockedOut("203.0.113.7")).toBe(false);
  });

  it("locks out only once the attempt limit is reached, not before", async () => {
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS - 1; i++) {
      await registerFailedLogin("203.0.113.7");
    }
    expect(await isLoginLockedOut("203.0.113.7")).toBe(false);

    await registerFailedLogin("203.0.113.7");
    expect(await isLoginLockedOut("203.0.113.7")).toBe(true);
  });

  it("limits each client separately", async () => {
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) {
      await registerFailedLogin("203.0.113.7");
    }

    expect(await isLoginLockedOut("203.0.113.7")).toBe(true);
    expect(await isLoginLockedOut("198.51.100.4")).toBe(false);
  });

  it("starts the expiry window on the first failure and never extends it", async () => {
    await registerFailedLogin("203.0.113.7");
    await registerFailedLogin("203.0.113.7");
    await registerFailedLogin("203.0.113.7");

    // Re-arming the expiry on every guess would let continuous attempts hold
    // the window open indefinitely, punishing the real officer long after.
    expect(expire).toHaveBeenCalledTimes(1);
    expect(expire).toHaveBeenCalledWith("loginattempts:203.0.113.7", LOGIN_WINDOW_SECONDS);
  });

  it("clears the count on a correct passcode", async () => {
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) {
      await registerFailedLogin("203.0.113.7");
    }
    expect(await isLoginLockedOut("203.0.113.7")).toBe(true);

    await clearFailedLogins("203.0.113.7");

    expect(await isLoginLockedOut("203.0.113.7")).toBe(false);
    // ...and the next failure opens a brand-new window.
    await registerFailedLogin("203.0.113.7");
    expect(expire).toHaveBeenCalledTimes(2);
  });
});
