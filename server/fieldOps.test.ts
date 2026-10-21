import { describe, expect, it } from "vitest";
import { empCodeSchema, monthlyPlanItemInputSchema, nextMondayDate, planInputSchema, visitInputSchema } from "../shared/fieldOps";

describe("field-operations validation", () => {
  it("suggests the following Monday when today is already Monday in India", () => {
    expect(nextMondayDate(new Date("2026-10-12T00:00:00.000Z"))).toBe("2026-10-19");
  });

  it("suggests the immediately upcoming Monday on Sunday", () => {
    expect(nextMondayDate(new Date("2026-10-11T00:00:00.000Z"))).toBe("2026-10-12");
  });

  it("accepts a complete visit entry and rejects a negative travel amount", () => {
    const base = { empCode: "ab-123", employeeName: "A. Kumar", visitDate: "2026-10-14", customerName: "North Star", location: "Pune", purpose: "Follow-up", travelMode: "Cab", distanceKm: 12.5, travelCost: 850, outcome: "Positive", notes: "" };
    expect(visitInputSchema.safeParse(base).success).toBe(true);
    expect(visitInputSchema.parse(base).empCode).toBe("AB-123");
    expect(visitInputSchema.safeParse({ ...base, travelCost: -1 }).success).toBe(false);
  });

  it("requires all ticket fields only when a planned stop requests a ticket", () => {
    const base = { empCode: "AB-123", employeeName: "A. Kumar", weekStartingDate: "2026-10-19", items: [{ customerName: "North Star", location: "Pune", purpose: "Service", applyForTicket: false }] };
    expect(planInputSchema.safeParse(base).success).toBe(true);
    expect(planInputSchema.safeParse({ ...base, weekStartingDate: "2026-10-20" }).success).toBe(false);
    expect(planInputSchema.safeParse({ ...base, items: [{ ...base.items[0], applyForTicket: true }] }).success).toBe(false);
    expect(planInputSchema.safeParse({ ...base, items: [{ ...base.items[0], applyForTicket: true, travelMode: "Train", routeFrom: "Mumbai", routeTo: "Pune", preferredDate: "2026-10-20" }] }).success).toBe(true);
  });
  it("normalizes valid Emp Codes and rejects malformed identifiers", () => {
    expect(empCodeSchema.parse(" ab-123 ")).toBe("AB-123");
    expect(empCodeSchema.safeParse("A").success).toBe(false);
    expect(empCodeSchema.safeParse("AB 123").success).toBe(false);
  });
  it("requires complete ticket details only when a monthly plan row requests a ticket", () => {
    const base = { plannedDate: "2026-10-05", customerName: "Fixture", location: "Hyderabad", purpose: "Follow-up", applyForTicket: false };
    expect(monthlyPlanItemInputSchema.safeParse(base).success).toBe(true);
    expect(monthlyPlanItemInputSchema.safeParse({ ...base, applyForTicket: true }).success).toBe(false);
    expect(monthlyPlanItemInputSchema.safeParse({ ...base, applyForTicket: true, travelMode: "Train", routeFrom: "Pune", routeTo: "Hyderabad", preferredDate: "2026-10-04" }).success).toBe(true);
  });
});
