import { describe, expect, it, vi } from "vitest";

import { fireAndForget } from "./fire-and-forget";

describe("fireAndForget", () => {
  it("swallows rejected promises", async () => {
    const reject = vi.fn().mockRejectedValue(new Error("fail"));
    expect(() => fireAndForget(reject())).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });

  it("does not block on resolved promises", () => {
    expect(() => fireAndForget(Promise.resolve("ok"))).not.toThrow();
  });
});
