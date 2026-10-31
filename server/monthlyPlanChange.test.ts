import { describe, expect, it } from "vitest";
import type { MonthlyPlanItemInput } from "../shared/fieldOps";
import { checkLockedMonthlyPlanDays, takeMatchingPreviousPlanItem } from "./monthlyPlanChange";

const item = (plannedDate: string, customerName = "Alpha Mining", changes: Partial<MonthlyPlanItemInput> = {}): MonthlyPlanItemInput => ({
  plannedDate, customerName, location: "Hyderabad", purpose: "Service", applyForTicket: false, travelMode: null, routeFrom: null, routeTo: null, preferredDate: null, remarks: "Quarterly visit", ...changes,
});
const setup = (overrides: Partial<Parameters<typeof checkLockedMonthlyPlanDays>[0]> = {}) => checkLockedMonthlyPlanDays({
  month: "2026-10", today: "2026-10-31", candidates: [{ rowNumber: 12, item: item("2026-10-29") }], savedItems: [item("2026-10-29")], answeredDates: [], currentPlanVersion: 4, basePlanVersion: 4, templateType: "change", enforce: true, ...overrides,
});

describe("employee monthly plan changes", () => {
  it("rejects an edited past day", () => {
    const errors = setup({ candidates: [{ rowNumber: 12, item: item("2026-10-29", "Beta Metals") }] });
    expect(errors[0]?.message).toContain("Row 12 · 29 Oct 2026 has already passed");
  });
  it("rejects a deleted past day", () => {
    const errors = setup({ candidates: [] });
    expect(errors[0]?.savedPlan).toContain("Alpha Mining, Hyderabad, Service");
    expect(errors[0]?.filePlan).toBe("No entry");
  });
  it("rejects an added past day", () => {
    const errors = setup({ savedItems: [], candidates: [{ rowNumber: 12, item: item("2026-10-29") }] });
    expect(errors[0]?.filePlan).toContain("Alpha Mining");
    expect(errors[0]?.savedPlan).toBe("No entry");
  });
  it("accepts a changed future day", () => {
    expect(setup({ today: "2026-10-20", candidates: [{ rowNumber: 12, item: item("2026-10-29", "Beta Metals") }], savedItems: [item("2026-10-29")] })).toEqual([]);
  });
  it("leaves first-time submissions unchanged", () => {
    expect(setup({ currentPlanVersion: 0, basePlanVersion: undefined, templateType: "standard", enforce: true })).toEqual([]);
  });
  it("locks a day with a daily check-in answer, including today", () => {
    const errors = setup({ today: "2026-10-29", savedItems: [item("2026-10-29")], candidates: [{ rowNumber: 12, item: item("2026-10-29", "Beta Metals") }], answeredDates: ["2026-10-29"] });
    expect(errors).toHaveLength(1);
  });
  it("rejects a stale template version", () => {
    expect(setup({ basePlanVersion: 3 })[0]?.message).toBe("Your plan changed after you downloaded this template. Download it again.");
  });
  it("applies the same lock check to a direct submit payload", () => {
    expect(setup({ candidates: [{ rowNumber: 1, item: item("2026-10-29", "Changed by direct request") }] })).toHaveLength(1);
  });
  it("reuses the same saved item id for unchanged past rows", () => {
    const previous = [{ id: 481, plannedDate: "2026-10-29", customerName: "Alpha Mining" }];
    expect(takeMatchingPreviousPlanItem(previous, item("2026-10-29"))?.id).toBe(481);
    expect(previous).toEqual([]);
  });
});
