import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createSaveQueue, RETRY_DELAYS_MS } from "@/lib/saveQueue";

// A save the test resolves or rejects by hand, so it can hold one in flight.
function controlledSave() {
  const calls = [];
  const save = vi.fn(
    (data) =>
      new Promise((resolve, reject) => {
        calls.push({ data, resolve, reject });
      }),
  );
  return { save, calls };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

function setup(save) {
  const statuses = [];
  const onSaved = vi.fn();
  const queue = createSaveQueue({ save, onSaved, onStatus: (s) => statuses.push(s.phase) });
  return { queue, statuses, onSaved };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createSaveQueue", () => {
  it("saves an edit and reports saving, then saved", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    const { queue, statuses, onSaved } = setup(save);

    await queue.enqueue("v1");

    expect(save).toHaveBeenCalledWith("v1");
    expect(statuses).toEqual(["saving", "saved"]);
    expect(onSaved).toHaveBeenCalledOnce();
    expect(queue.hasUnsavedWork()).toBe(false);
  });

  it("holds edits made during a save and sends only the newest one after it", async () => {
    const { save, calls } = controlledSave();
    const { queue } = setup(save);

    queue.enqueue("v1");
    queue.enqueue("v2");
    queue.enqueue("v3");
    expect(save).toHaveBeenCalledTimes(1);
    expect(queue.hasUnsavedWork()).toBe(true);

    calls[0].resolve({ ok: true });
    await flush();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("v3");
    calls[1].resolve({ ok: true });
    await flush();
    expect(queue.hasUnsavedWork()).toBe(false);
    expect(queue.getStatus().phase).toBe("saved");
  });

  it("retries a save that throws after 1, 3, and 9 seconds, then gives up", async () => {
    const save = vi.fn().mockRejectedValue(new Error("offline"));
    const { queue, statuses } = setup(save);

    await queue.enqueue("v1");
    expect(queue.getStatus().phase).toBe("retrying");

    for (const delay of RETRY_DELAYS_MS) {
      const before = save.mock.calls.length;
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(save).toHaveBeenCalledTimes(before);
      await vi.advanceTimersByTimeAsync(1);
      expect(save).toHaveBeenCalledTimes(before + 1);
    }

    expect(save).toHaveBeenCalledTimes(1 + RETRY_DELAYS_MS.length);
    expect(save.mock.calls.every(([data]) => data === "v1")).toBe(true);
    expect(statuses.at(-1)).toBe("failed");
    expect(queue.hasUnsavedWork()).toBe(true);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(1 + RETRY_DELAYS_MS.length);
  });

  it("sends the failed edit again on retry()", async () => {
    const save = vi.fn().mockRejectedValue(new Error("offline"));
    const { queue } = setup(save);
    await queue.enqueue("v1");
    await vi.runAllTimersAsync();
    expect(queue.getStatus().phase).toBe("failed");

    save.mockResolvedValueOnce({ ok: true });
    await queue.retry();

    expect(save).toHaveBeenLastCalledWith("v1");
    expect(queue.getStatus().phase).toBe("saved");
    expect(queue.hasUnsavedWork()).toBe(false);
  });

  it("recovers when the connection comes back during the retries", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ ok: true });
    const { queue } = setup(save);

    await queue.enqueue("v1");
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);

    expect(save).toHaveBeenCalledTimes(2);
    expect(queue.getStatus().phase).toBe("saved");
  });

  it("lets a newer edit replace the one waiting to be retried", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ ok: true });
    const { queue } = setup(save);

    await queue.enqueue("v1");
    await queue.enqueue("v2");
    expect(save).toHaveBeenLastCalledWith("v2");
    expect(queue.getStatus().phase).toBe("saved");

    // The old retry was cancelled rather than sending v1 over v2.
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("sends an edit made while a failing save was in flight instead of retrying the old one", async () => {
    const { save, calls } = controlledSave();
    const { queue } = setup(save);

    queue.enqueue("v1");
    queue.enqueue("v2");
    calls[0].reject(new Error("offline"));
    await flush();

    expect(save).toHaveBeenLastCalledWith("v2");
    expect(queue.getStatus().phase).toBe("saving");
  });

  it("does not retry a save the server refused, and reports why", async () => {
    const save = vi.fn().mockResolvedValue({ ok: false, error: "A category needs a name." });
    const { queue } = setup(save);

    await queue.enqueue("v1");
    await vi.runAllTimersAsync();

    expect(save).toHaveBeenCalledOnce();
    expect(queue.getStatus()).toEqual({ phase: "invalid", error: "A category needs a name." });
    expect(queue.hasUnsavedWork()).toBe(true);
    await queue.retry();
    expect(save).toHaveBeenCalledOnce();
  });

  it("clears a refusal once a later edit saves", async () => {
    const save = vi.fn().mockResolvedValueOnce({ ok: false, error: "No." }).mockResolvedValue({ ok: true });
    const { queue } = setup(save);

    await queue.enqueue("v1");
    await queue.enqueue("v2");

    expect(queue.getStatus().phase).toBe("saved");
    expect(queue.hasUnsavedWork()).toBe(false);
  });

  it("skips reporting a refusal when a newer edit is already waiting", async () => {
    const { save, calls } = controlledSave();
    const { queue, statuses } = setup(save);

    queue.enqueue("v1");
    queue.enqueue("v2");
    calls[0].resolve({ ok: false, error: "No." });
    await flush();

    expect(statuses).not.toContain("invalid");
    expect(save).toHaveBeenLastCalledWith("v2");
  });

  it("stops a scheduled retry on dispose", async () => {
    const save = vi.fn().mockRejectedValue(new Error("offline"));
    const { queue } = setup(save);
    await queue.enqueue("v1");

    queue.dispose();
    await vi.runAllTimersAsync();

    expect(save).toHaveBeenCalledOnce();
  });
});
