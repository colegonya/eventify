import { describe, it, expect, vi } from "vitest";
import { prefetchForSemester } from "@/lib/semesterPrefetch";

describe("prefetchForSemester", () => {
  it("starts the read right away when the URL names a semester, and reuses it", async () => {
    const load = vi.fn(async (id) => `data for ${id}`);
    const loadFor = prefetchForSemester("fall-2026", load);
    expect(load).toHaveBeenCalledWith("fall-2026");

    await expect(loadFor("fall-2026")).resolves.toBe("data for fall-2026");
    expect(load).toHaveBeenCalledOnce();
  });

  it("reads the semester the page settled on when it differs from the URL's", async () => {
    const load = vi.fn(async (id) => `data for ${id}`);
    const loadFor = prefetchForSemester("deleted-semester", load);

    await expect(loadFor("spring-2027")).resolves.toBe("data for spring-2027");
    expect(load.mock.calls.map(([id]) => id)).toEqual(["deleted-semester", "spring-2027"]);
  });

  it("waits for the semester list when the URL names none", async () => {
    const load = vi.fn(async (id) => id);
    const loadFor = prefetchForSemester(undefined, load);
    expect(load).not.toHaveBeenCalled();
    await loadFor("fall-2026");
    expect(load).toHaveBeenCalledWith("fall-2026");
  });

  it("ignores a repeated ?semester= (an array) instead of reading it", () => {
    const load = vi.fn(async () => null);
    prefetchForSemester(["a", "b"], load);
    expect(load).not.toHaveBeenCalled();
  });

  it("doesn't raise an unhandled rejection for an early read that goes unused", async () => {
    const onUnhandled = vi.fn();
    process.on("unhandledRejection", onUnhandled);
    const load = vi.fn(async (id) => {
      if (id === "bad") throw new Error("nope");
      return id;
    });
    const loadFor = prefetchForSemester("bad", load);
    await loadFor("good");
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off("unhandledRejection", onUnhandled);
    expect(onUnhandled).not.toHaveBeenCalled();
  });
});
