import { describe, expect, it } from "vitest";
import { buildDailyEmail, hasRelevantActivities, indiaDateString, type DailyEmployeeSchedule } from "./dailyEmailContent";
import { assembleDailySchedule } from "./dailyEmailData";
import { getNotificationInsertId } from "./dailyEmailService";

const date = "2026-11-03";
const plan = (id: number, plannedDate = date) => ({ id, customerName: `Customer ${id}`, location: "Kolkata", purpose: "Review", plannedDate, applyForTicket: true, travelMode: "Car", routeFrom: "Office", routeTo: "Customer", remarks: "Bring documents" });
const status = (values: Record<string, unknown>) => ({ id: 1, plannedVisitId: 1, parentStatusId: null, originalPlannedDate: null, customerName: "Customer 1", location: "Kolkata", purpose: "Review", source: "Planned", status: "Visited", reason: null, newDate: null, notes: null, ...values }) as never;
const followup = (values: Record<string, unknown>) => ({ followUp: { id: 1, visitId: 4, empCode: "E1", customerName: "Customer 4", followUpDate: date, followUpPurpose: "Send quote", note: "Call first", status: "Pending" }, visit: { id: 4, empCode: "E1", customerName: "Customer 4", visitDate: "2026-10-30", location: "Howrah" }, ...values }) as never;
const empty: DailyEmployeeSchedule = { scheduledVisits: [], rescheduledVisits: [], todaysFollowUps: [], overdueFollowUps: [] };

describe("daily notification content", () => {
  it("reads the insert ID from the MySQL driver result tuple", () => {
    expect(getNotificationInsertId([{ insertId: 42, affectedRows: 1 }, []])).toBe(42);
    expect(getNotificationInsertId({ insertId: 42 })).toBe(42);
  });
  it("includes scheduled visits only with details", () => {
    const result = assembleDailySchedule(date, [plan(1)], [], []);
    expect(result.scheduledVisits).toHaveLength(1);
    expect(result.scheduledVisits[0].routeDetails).toContain("Office to Customer");
  });
  it("separates a moved visit into the rescheduled section and avoids counting it twice", () => {
    const result = assembleDailySchedule(date, [plan(1, "2026-11-01")], [status({ id: 9, plannedVisitId: 1, parentStatusId: 8, originalPlannedDate: "2026-11-01", status: "Planned" })], []);
    expect(result.scheduledVisits).toHaveLength(0);
    expect(result.rescheduledVisits).toHaveLength(1);
    expect(result.rescheduledVisits[0].originalVisitDate).toBe("2026-11-01");
  });
  it("includes due and overdue pending follow-ups, excluding completed follow-ups", () => {
    const result = assembleDailySchedule(date, [], [], [followup({}), followup({ followUp: { id: 2, visitId: 4, empCode: "E1", customerName: "Overdue", followUpDate: "2026-11-02", followUpPurpose: "Call", note: null, status: "Pending" } }), followup({ followUp: { id: 3, visitId: 4, empCode: "E1", customerName: "Done", followUpDate: date, followUpPurpose: "Call", note: null, status: "Done" } })]);
    expect(result.todaysFollowUps).toHaveLength(1);
    expect(result.overdueFollowUps).toHaveLength(1);
    expect(result.overdueFollowUps[0].customerName).toBe("Overdue");
  });
  it("builds a consolidated personalized email with all always-visible sections and summary", () => {
    const schedule = assembleDailySchedule(date, [plan(1)], [status({})], [followup({})]);
    const result = buildDailyEmail({ employee: { employeeName: "Asha" }, date, schedule, dashboardUrl: "https://fielddesk.example" });
    expect(result.subject).toContain("FieldDesk | Your Daily Visit & Follow-up Schedule");
    expect(result.html).toContain("Dear Asha");
    expect(result.html).toContain("TODAY’S SCHEDULED VISITS");
    expect(result.html).toContain("RESCHEDULED VISITS");
    expect(result.html).toContain("FOLLOW-UP ACTIVITIES");
    expect(result.html).toContain("Daily summary");
  });
  it("skips employees without activities and shows empty-state copy", () => {
    expect(hasRelevantActivities(empty)).toBe(false);
    expect(buildDailyEmail({ employee: { employeeName: "Asha" }, date, schedule: empty, dashboardUrl: "https://fielddesk.example" }).html).toContain("No activities scheduled.");
  });
  it("uses India calendar date around UTC midnight", () => {
    expect(indiaDateString(new Date("2026-11-02T19:00:00.000Z"))).toBe("2026-11-03");
  });
});
