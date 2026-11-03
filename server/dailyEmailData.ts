import { and, eq, inArray, lte } from "drizzle-orm";
import { followUps, monthlyPlanItems, visits } from "../drizzle/schema";
import { getDb } from "./db";
import type { DailyEmployeeSchedule, EmailFollowUp, EmailRescheduledVisit, EmailScheduledVisit } from "./dailyEmailContent";
import { listEmployeeDailyItems } from "./fieldOpsV3Db";

type PlanCandidate = {
  id: number;
  customerName: string;
  location: string;
  purpose: string;
  plannedDate: string;
  applyForTicket: boolean;
  travelMode: string | null;
  routeFrom: string | null;
  routeTo: string | null;
  remarks: string | null;
};
type StatusCandidate = {
  id: number;
  plannedVisitId: number | null;
  parentStatusId: number | null;
  originalPlannedDate: string | null;
  customerName: string;
  location: string;
  purpose: string;
  source: "Planned" | "Unplanned";
  status: "Planned" | "Visited" | "Missed" | "Rescheduled";
  reason: string | null;
  newDate: string | null;
  notes: string | null;
};
type FollowUpCandidate = {
  followUp: typeof followUps.$inferSelect;
  visit: typeof visits.$inferSelect;
};

function routeDetails(item?: PlanCandidate) {
  if (!item?.applyForTicket) return "";
  const route = [item.routeFrom, item.routeTo].filter(Boolean).join(" to ");
  return [item.travelMode, route].filter(Boolean).join(" · ");
}

function visitDetails(input: {
  customerName: string; location: string; purpose: string; visitDate: string; status: string;
  item?: PlanCandidate; remarks?: string | null;
}): EmailScheduledVisit {
  return {
    customerName: input.customerName,
    visitDate: input.visitDate,
    location: input.location,
    purpose: input.purpose,
    travelMode: input.item?.travelMode ?? "",
    routeDetails: routeDetails(input.item),
    remarks: input.item?.remarks ?? input.remarks ?? "",
    status: input.status,
  };
}

export function assembleDailySchedule(date: string, planned: PlanCandidate[], statuses: StatusCandidate[], followUpRows: FollowUpCandidate[]): DailyEmployeeSchedule {
  const sentinels = new Set(["no visit", "office", "leave"]);
  const itemById = new Map(planned.map(item => [item.id, item]));
  const liveItems = planned.filter(item => item.plannedDate === date && !sentinels.has(item.customerName.trim().toLocaleLowerCase("en-IN")));
  const statusByPlannedVisit = new Map<number, StatusCandidate>();
  for (const row of statuses) {
    if (row.plannedVisitId === null) continue;
    const prior = statusByPlannedVisit.get(row.plannedVisitId);
    if (!prior || row.id > prior.id) statusByPlannedVisit.set(row.plannedVisitId, row);
  }

  const scheduledVisits = liveItems.flatMap(item => {
    const latest = statusByPlannedVisit.get(item.id);
    if (latest?.status === "Rescheduled" && latest.newDate !== date) return [];
    if (latest?.status === "Planned" && latest.parentStatusId !== null) return [];
    const status = latest?.parentStatusId ? "Rescheduled" : latest?.status === "Planned" || !latest ? "Scheduled" : latest.status;
    return [visitDetails({ customerName: item.customerName, location: item.location, purpose: item.purpose, visitDate: date, status, item, remarks: latest?.notes })];
  });

  const moved = new Map<string, StatusCandidate>();
  for (const row of statuses) {
    if (row.status !== "Planned" || row.parentStatusId === null || row.source !== "Planned" || row.plannedVisitId === null) continue;
    const key = String(row.plannedVisitId);
    const prior = moved.get(key);
    if (!prior || row.id > prior.id) moved.set(key, row);
  }
  const rescheduledVisits: EmailRescheduledVisit[] = [...moved.values()].map(row => {
    const item = itemById.get(row.plannedVisitId!) ?? planned.find(candidate => candidate.id === row.plannedVisitId);
    return {
      ...visitDetails({ customerName: row.customerName, location: row.location, purpose: row.purpose, visitDate: date, status: "Rescheduled", item, remarks: row.notes }),
      originalVisitDate: row.originalPlannedDate ?? "",
      newVisitDate: date,
      reason: row.reason ?? "",
    };
  });

  const todaysFollowUps: EmailFollowUp[] = [];
  const overdueFollowUps: EmailFollowUp[] = [];
  for (const { followUp, visit } of followUpRows) {
    if (followUp.status !== "Pending" && followUp.status !== "Rescheduled") continue;
    const item: EmailFollowUp = {
      customerName: followUp.customerName,
      followUpDate: followUp.followUpDate,
      purpose: followUp.followUpPurpose ?? "",
      location: visit.location ?? "",
      previousVisitReference: `${visit.visitDate} · ${visit.customerName}`,
      status: followUp.status,
      remarks: followUp.note ?? "",
    };
    if (followUp.followUpDate === date) todaysFollowUps.push(item);
    else if (followUp.followUpDate < date && followUp.status === "Pending") overdueFollowUps.push(item);
  }
  return { scheduledVisits, rescheduledVisits, todaysFollowUps, overdueFollowUps };
}

export async function loadDailyEmployeeSchedule(empCode: string, date: string): Promise<DailyEmployeeSchedule> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  // Use the same submitted-plan selection as the employee's daily visit screen.
  const dailyItems = await listEmployeeDailyItems(empCode, date);
  const followUpRows = await db.select({ followUp: followUps, visit: visits })
    .from(followUps)
    .innerJoin(visits, eq(followUps.visitId, visits.id))
    .where(and(
      eq(followUps.empCode, empCode),
      eq(visits.empCode, empCode),
      lte(followUps.followUpDate, date),
      inArray(followUps.status, ["Pending", "Rescheduled"]),
    ));
  const referencedIds = [...new Set([
    ...dailyItems.planned.map(item => item.id),
    ...dailyItems.planned.map(item => item.plannedVisitId),
    ...dailyItems.moved.map(item => item.plannedVisitId),
  ].filter((id): id is number => id !== null))];
  const planItems = referencedIds.length ? await db.select().from(monthlyPlanItems).where(inArray(monthlyPlanItems.id, referencedIds)) : [];
  return assembleDailySchedule(date, planItems, dailyItems.statuses, followUpRows);
}
