import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("Phase 1 API boundary", () => {
  it("keeps field operations available without exposing an auth router", () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "http", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    expect(caller.fieldOps).toBeDefined();
    expect("auth" in caller).toBe(false);
  });
});
