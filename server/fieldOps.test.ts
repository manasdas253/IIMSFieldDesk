import { describe, expect, it } from "vitest";
import { dailyVisitActionSchema, empCodeSchema, followUpInputSchema, monthlyPlanItemInputSchema, nextMondayDate, planInputSchema, visitInputSchema } from "../shared/fieldOps";

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
    const withoutOptionalTravel = { ...base } as Record<string, unknown>;
    delete withoutOptionalTravel.travelMode;
    delete withoutOptionalTravel.distanceKm;
    delete withoutOptionalTravel.travelCost;
    const optionalTravel = visitInputSchema.safeParse(withoutOptionalTravel);
    expect(optionalTravel.success).toBe(true);
    if (optionalTravel.success) expect(optionalTravel.data).toMatchObject({ travelMode: "Own Vehicle", distanceKm: 0, travelCost: 0 });
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
  it("accepts Call and Email follow-ups without a scheduled time", () => {
    const base = { visitId: 1, empCode: "AB-123", customerName: "North Star", followUpDate: "2026-10-29" };
    expect(followUpInputSchema.safeParse({ ...base, followUpPurpose: "Call" }).success).toBe(true);
    expect(followUpInputSchema.safeParse({ ...base, followUpPurpose: "Email" }).success).toBe(true);
  });
  it("requires a valid date and time for a scheduled Visit follow-up", () => {
    const base = { visitId: 1, empCode: "AB-123", customerName: "North Star", followUpPurpose: "Visit" };
    expect(followUpInputSchema.safeParse({ ...base, followUpDate: "2026-10-29", followUpTime: "14:30" }).success).toBe(true);
    expect(followUpInputSchema.safeParse({ ...base, followUpDate: "2026-02-30", followUpTime: "14:30" }).success).toBe(false);
    expect(followUpInputSchema.safeParse({ ...base, followUpDate: "2026-10-29" }).success).toBe(false);
    expect(followUpInputSchema.safeParse({ ...base, followUpDate: "2026-10-29", followUpTime: "25:61" }).success).toBe(false);
  });
  it("supports Call and Email in daily check-in and requires a schedule for Visit", () => {
    const base = { visitDate: "2026-10-29", plannedVisitId: 7, customerName: "North Star", visitedPersonName: "Asha Mehta", location: "Pune", purpose: "Follow-up", status: "Visited", outcome: "Positive" };
    expect(dailyVisitActionSchema.safeParse({ ...base, followUpDate: "2026-10-29", followUpPurpose: "Call" }).success).toBe(true);
    expect(dailyVisitActionSchema.safeParse({ ...base, followUpDate: "2026-10-29", followUpPurpose: "Email" }).success).toBe(true);
    expect(dailyVisitActionSchema.safeParse({ ...base, followUpDate: "2026-10-30", followUpPurpose: "Visit", followUpTime: "14:30" }).success).toBe(true);
    expect(dailyVisitActionSchema.safeParse({ ...base, followUpDate: "2026-10-30", followUpPurpose: "Visit" }).success).toBe(false);
    expect(dailyVisitActionSchema.safeParse({ ...base, followUpDate: "2026-02-30", followUpPurpose: "Visit", followUpTime: "14:30" }).success).toBe(false);
    expect(dailyVisitActionSchema.safeParse({ ...base, visitedPersonName: " " }).success).toBe(false);
  });
  it("requires complete ticket details only when a monthly plan row requests a ticket", () => {
    const base = { plannedDate: "2026-10-05", customerName: "Fixture", location: "Hyderabad", purpose: "Follow-up", applyForTicket: false };
    expect(monthlyPlanItemInputSchema.safeParse(base).success).toBe(true);
    expect(monthlyPlanItemInputSchema.safeParse({ ...base, applyForTicket: true }).success).toBe(false);
    expect(monthlyPlanItemInputSchema.safeParse({ ...base, applyForTicket: true, travelMode: "Train", routeFrom: "Pune", routeTo: "Hyderabad", preferredDate: "2026-10-04" }).success).toBe(true);
  });
});
