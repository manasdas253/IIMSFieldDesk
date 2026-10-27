import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFollowUp: vi.fn(),
  listFollowUps: vi.fn(),
  followUpDueSummary: vi.fn(),
  markFollowUpDone: vi.fn(),
  rescheduleFollowUp: vi.fn(),
  cancelFollowUp: vi.fn(),
}));

vi.mock("./fieldOpsV3Db", async importOriginal => {
  const actual = await importOriginal<typeof import("./fieldOpsV3Db")>();
  return { ...actual, ...mocks };
});

import { appRouter } from "./routers";

const employee = { id: 12, empCode: "EMP012", employeeName: "Employee Twelve", role: "employee" as const, mustChangePassword: false };
const admin = { id: 1, empCode: "ADMIN1", employeeName: "Administrator", role: "admin" as const, mustChangePassword: false };
const caller = (user: typeof employee | typeof admin) => appRouter.createCaller({ req: {} as never, res: {} as never, user });

describe("follow-up employee ownership", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("scopes employee list and due queries to the signed-in employee", async () => {
    mocks.listFollowUps.mockResolvedValue([]);
    mocks.followUpDueSummary.mockResolvedValue([]);
    await caller(employee).fieldOps.followUps.list({ empCode: "EMP999", status: "Pending" });
    await caller(employee).fieldOps.followUps.dueSummary({ empCode: "EMP999" });
    expect(mocks.listFollowUps).toHaveBeenCalledWith({ empCode: "EMP012", status: "Pending" });
    expect(mocks.followUpDueSummary).toHaveBeenCalledWith("EMP012", expect.any(String));
  });

  it.each([
    ["markDone", () => caller(employee).fieldOps.followUps.markDone({ id: 5 })],
    ["reschedule", () => caller(employee).fieldOps.followUps.reschedule({ id: 5, followUpDate: "2026-10-26" })],
    ["cancel", () => caller(employee).fieldOps.followUps.cancel({ id: 5 })],
  ])("prevents employees changing another employee's follow-up (%s)", async (_name, run) => {
    mocks.getFollowUp.mockResolvedValue({ id: 5, empCode: "EMP999" });
    await expect(run()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.markFollowUpDone).not.toHaveBeenCalled();
    expect(mocks.rescheduleFollowUp).not.toHaveBeenCalled();
    expect(mocks.cancelFollowUp).not.toHaveBeenCalled();
  });

  it("allows employees to change their own follow-up", async () => {
    mocks.getFollowUp.mockResolvedValue({ id: 5, empCode: "EMP012" });
    mocks.markFollowUpDone.mockResolvedValue({ id: 5, empCode: "EMP012", status: "Done" });
    await expect(caller(employee).fieldOps.followUps.markDone({ id: 5 })).resolves.toMatchObject({ status: "Done" });
    expect(mocks.markFollowUpDone).toHaveBeenCalledWith(5);
  });

  it("preserves administrator access across employees", async () => {
    mocks.listFollowUps.mockResolvedValue([]);
    mocks.getFollowUp.mockResolvedValue({ id: 5, empCode: "EMP999" });
    mocks.markFollowUpDone.mockResolvedValue({ id: 5, empCode: "EMP999", status: "Done" });
    await caller(admin).fieldOps.followUps.list({ empCode: "EMP999" });
    await expect(caller(admin).fieldOps.followUps.markDone({ id: 5 })).resolves.toMatchObject({ status: "Done" });
    expect(mocks.listFollowUps).toHaveBeenCalledWith({ empCode: "EMP999" });
    expect(mocks.markFollowUpDone).toHaveBeenCalledWith(5);
  });
});
