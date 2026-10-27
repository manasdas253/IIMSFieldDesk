import { and, asc, eq, gte, inArray, isNotNull, lte, or } from "drizzle-orm";
import { dailyVisitStatuses, employees, followUps, monthlyPlanItems, monthlyPlans, planHolidays, visits } from "../drizzle/schema";
import { currentMonthlyPlanItems, type EmployeeInput, type FollowUpInput, type MonthlyPlanSubmitInput, type dailyVisitActionSchema } from "../shared/fieldOps";
import type { z } from "zod";
import { getDb } from "./db";

export async function listEmployeeMaster(includeInactive = true) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(employees).where(includeInactive ? undefined : eq(employees.isActive, true)).orderBy(asc(employees.empCode));
  return rows.map(({ passwordHash: _passwordHash, ...row }) => row);
}
export async function createEmployee(input: EmployeeInput) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await db.insert(employees).values({ ...input, empCode: input.empCode.trim().toUpperCase(), designation: input.designation || null, department: input.department || null, mobile: input.mobile || null });
  const [row] = await db.select().from(employees).where(eq(employees.empCode, input.empCode.trim().toUpperCase())).limit(1);
  if (!row) return row;
  const { passwordHash: _passwordHash, ...safe } = row;
  return safe;
}
export async function updateEmployee(id: number, input: EmployeeInput) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await db.update(employees).set({ ...input, empCode: input.empCode.trim().toUpperCase(), designation: input.designation || null, department: input.department || null, mobile: input.mobile || null }).where(eq(employees.id, id));
  const [row] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
  if (!row) return null;
  const { passwordHash: _passwordHash, ...safe } = row;
  return safe;
}
export async function setEmployeeActive(empCode: string, isActive: boolean) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await db.update(employees).set({ isActive }).where(eq(employees.empCode, empCode));
  const [row] = await db.select().from(employees).where(eq(employees.empCode, empCode)).limit(1);
  if (!row) return null;
  const { passwordHash: _passwordHash, ...safe } = row;
  return safe;
}

export async function submitMonthlyPlan(input: MonthlyPlanSubmitInput) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const [employee] = await db.select().from(employees).where(and(eq(employees.empCode, input.empCode), eq(employees.isActive, true))).limit(1);
  if (!employee) throw new Error("Emp Code is unknown or inactive.");
  const prefix = `${input.planMonth}-`;
  for (const row of input.items) if (!row.plannedDate.startsWith(prefix)) throw new Error(`Planned date ${row.plannedDate} is outside ${input.planMonth}.`);
  return db.transaction(async tx => {
    const [existing] = await tx.select().from(monthlyPlans).where(and(eq(monthlyPlans.empCode, employee.empCode), eq(monthlyPlans.planMonth, input.planMonth))).limit(1);
    const version = existing ? existing.version + 1 : 1;
    let planId: number;
    let priorItems: typeof monthlyPlanItems.$inferSelect[] = [];
    if (existing) {
      planId = existing.id;
      priorItems = (await tx.select().from(monthlyPlanItems).where(eq(monthlyPlanItems.planId, planId))).sort((a, b) => b.version - a.version || a.id - b.id);
      await tx.update(monthlyPlans).set({ employeeName: employee.employeeName, status: "Submitted", version, submittedAt: new Date() }).where(eq(monthlyPlans.id, planId));
    } else {
      const [created] = await tx.insert(monthlyPlans).values({ empCode: employee.empCode, employeeName: employee.employeeName, planMonth: input.planMonth, status: "Submitted", version, submittedAt: new Date() });
      planId = Number((created as { insertId?: number }).insertId);
    }
    const remainingPrior = [...priorItems];
    for (const item of input.items) {
      const normalizedCustomer = item.customerName.trim().toLocaleLowerCase("en-IN");
      const exactMatch = remainingPrior.findIndex(row => row.customerName.trim().toLocaleLowerCase("en-IN") === normalizedCustomer && row.plannedDate === item.plannedDate);
      const matchIndex = exactMatch >= 0 ? exactMatch : remainingPrior.findIndex(row => row.customerName.trim().toLocaleLowerCase("en-IN") === normalizedCustomer);
      const values = { version, plannedDate: item.plannedDate, customerName: item.customerName, location: item.location, purpose: item.purpose, applyForTicket: item.applyForTicket, travelMode: item.applyForTicket ? item.travelMode ?? null : null, routeFrom: item.applyForTicket ? item.routeFrom ?? null : null, routeTo: item.applyForTicket ? item.routeTo ?? null : null, preferredDate: item.applyForTicket ? item.preferredDate ?? null : null, remarks: item.remarks || null };
      if (matchIndex >= 0) { const [previous] = remainingPrior.splice(matchIndex, 1); await tx.update(monthlyPlanItems).set(values).where(eq(monthlyPlanItems.id, previous.id)); }
      else await tx.insert(monthlyPlanItems).values({ planId, ...values });
    }
    return { id: planId, empCode: employee.empCode, employeeName: employee.employeeName, planMonth: input.planMonth, version, status: "Submitted" as const };
  });
}
export async function listMonthlyPlanReport(month: string, empCode?: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const roster = await db.select().from(employees).where(empCode ? eq(employees.empCode, empCode) : undefined).orderBy(asc(employees.empCode));
  if (!roster.length) return [];
  const plans = await db.select().from(monthlyPlans).where(and(eq(monthlyPlans.planMonth, month), empCode ? eq(monthlyPlans.empCode, empCode) : undefined));
  const planIds = plans.map(plan => plan.id);
  const allItems = planIds.length ? await db.select().from(monthlyPlanItems).where(inArray(monthlyPlanItems.planId, planIds)).orderBy(asc(monthlyPlanItems.plannedDate), asc(monthlyPlanItems.id)) : [];
  const items = plans.flatMap(plan => currentMonthlyPlanItems(allItems.filter(item => item.planId === plan.id), plan.version));
  const planByCode = new Map(plans.map(plan => [plan.empCode, plan]));
  const itemsByPlan = new Map<number, typeof items>();
  items.forEach(item => itemsByPlan.set(item.planId, [...(itemsByPlan.get(item.planId) ?? []), item]));
  return roster.map(employee => {
    const plan = planByCode.get(employee.empCode);
    const planItems = plan ? itemsByPlan.get(plan.id) ?? [] : [];
    return { empCode: employee.empCode, name: employee.employeeName, month, status: plan?.status ?? "Not submitted", version: plan?.version ?? 0, plannedVisits: planItems.length, distinctCustomers: new Set(planItems.map(item => item.customerName.trim().toLocaleLowerCase("en-IN"))).size, ticketsRequested: planItems.filter(item => item.applyForTicket).length, planItems, plan };
  });
}

/** Current submitted plan rows only; stable item IDs keep daily-log references attached across resubmissions. */
export async function listExecutiveMonthlyTravel(month: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const plans = await db.select().from(monthlyPlans).where(and(eq(monthlyPlans.planMonth, month), eq(monthlyPlans.status, "Submitted")));
  const planIds = plans.map(plan => plan.id);
  if (!planIds.length) return [];
  const [items, roster] = await Promise.all([
    db.select().from(monthlyPlanItems).where(inArray(monthlyPlanItems.planId, planIds)).orderBy(asc(monthlyPlanItems.plannedDate), asc(monthlyPlanItems.id)),
    db.select().from(employees),
  ]);
  const employeeByCode = new Map(roster.map(employee => [employee.empCode, employee]));
  return plans.flatMap(plan => currentMonthlyPlanItems(items.filter(item => item.planId === plan.id), plan.version).map(item => {
    const employee = employeeByCode.get(plan.empCode);
    return { id: item.id, plannedDate: item.plannedDate, empCode: plan.empCode, employeeName: plan.employeeName, department: employee?.department ?? "", customerName: item.customerName, location: item.location, purpose: item.purpose, remarks: item.remarks ?? "", planMonth: month, version: plan.version, submittedAt: plan.submittedAt };
  }));
}
export async function listPlanHolidays(from?: string, to?: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const where = from || to ? and(from ? gte(planHolidays.holidayDate, from) : undefined, to ? lte(planHolidays.holidayDate, to) : undefined) : undefined;
  return db.select().from(planHolidays).where(where).orderBy(asc(planHolidays.holidayDate));
}
export async function createPlanHoliday(input: { holidayDate: string; name: string }) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const [result] = await db.insert(planHolidays).values(input);
  const [row] = await db.select().from(planHolidays).where(eq(planHolidays.id, Number((result as { insertId?: number }).insertId))).limit(1);
  return row;
}
export async function deletePlanHoliday(id: number) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await db.delete(planHolidays).where(eq(planHolidays.id, id)); return { success: true as const };
}
export async function listFollowUps(filter: { empCode?: string; status?: string; from?: string; to?: string }) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const statusCondition = filter.status === "Pending" ? inArray(followUps.status, ["Pending", "Rescheduled"]) : filter.status ? eq(followUps.status, filter.status as typeof followUps.status.enumValues[number]) : undefined;
  const conditions = [filter.empCode ? eq(followUps.empCode, filter.empCode) : undefined, statusCondition, filter.from ? gte(followUps.followUpDate, filter.from) : undefined, filter.to ? lte(followUps.followUpDate, filter.to) : undefined].filter(Boolean);
  return db.select().from(followUps).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(followUps.followUpDate), asc(followUps.followUpTime));
}
export async function createFollowUp(input: FollowUpInput) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const [result] = await db.insert(followUps).values({ ...input, status: "Pending", empCode: input.empCode ?? null, followUpTime: input.followUpTime ?? null, note: input.note || null });
  const [row] = await db.select().from(followUps).where(eq(followUps.id, Number((result as { insertId?: number }).insertId))).limit(1);
  return row;
}
export async function markFollowUpDone(id: number) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await db.update(followUps).set({ status: "Done", completedAt: new Date() }).where(eq(followUps.id, id));
  const [row] = await db.select().from(followUps).where(eq(followUps.id, id)).limit(1); return row ?? null;
}
export async function rescheduleFollowUp(id: number, followUpDate: string, followUpTime?: string | null) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await db.update(followUps).set({ followUpDate, followUpTime: followUpTime ?? null, status: "Rescheduled" }).where(eq(followUps.id, id));
  const [row] = await db.select().from(followUps).where(eq(followUps.id, id)).limit(1); return row ?? null;
}
export async function cancelFollowUp(id: number) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await db.update(followUps).set({ status: "Cancelled" }).where(eq(followUps.id, id)); return { success: true as const };
}
export async function followUpDueSummary(empCode: string | undefined, today: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const where = and(inArray(followUps.status, ["Pending", "Rescheduled"]), lte(followUps.followUpDate, today), empCode ? eq(followUps.empCode, empCode) : undefined);
  return db.select().from(followUps).where(where).orderBy(asc(followUps.followUpDate));
}
export async function getEmployeeForVisit(visitId: number) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const [row] = await db.select({ visit: visits, employee: employees }).from(visits).leftJoin(employees, eq(visits.empCode, employees.empCode)).where(eq(visits.id, visitId)).limit(1);
  return row ?? null;
}

export async function getFollowUp(id: number) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const [row] = await db.select().from(followUps).where(eq(followUps.id, id)).limit(1);
  return row ?? null;
}

export async function listEmployeeDailyItems(empCode: string, date: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const month = date.slice(0, 7);
  const planRows = await db.select({ plan: monthlyPlans, item: monthlyPlanItems }).from(monthlyPlans).innerJoin(monthlyPlanItems, eq(monthlyPlans.id, monthlyPlanItems.planId)).where(and(eq(monthlyPlans.empCode, empCode), eq(monthlyPlans.planMonth, month), eq(monthlyPlans.status, "Submitted"), eq(monthlyPlanItems.plannedDate, date)));
  const moved = await db.select().from(dailyVisitStatuses).where(and(eq(dailyVisitStatuses.empCode, empCode), eq(dailyVisitStatuses.visitDate, date), isNotNull(dailyVisitStatuses.parentStatusId), eq(dailyVisitStatuses.source, "Planned")));
  const dayStatuses = await db.select().from(dailyVisitStatuses).where(and(eq(dailyVisitStatuses.empCode, empCode), eq(dailyVisitStatuses.visitDate, date)));
  const currentRows = planRows.filter(({ plan, item }) => currentMonthlyPlanItems([item], plan.version).length > 0);
  const itemIds = currentRows.map(({ item }) => item.id);
  const history = itemIds.length ? await db.select().from(dailyVisitStatuses).where(and(eq(dailyVisitStatuses.empCode, empCode), inArray(dailyVisitStatuses.plannedVisitId, itemIds))) : [];
  const movedForCurrent = new Map(moved.filter(row => row.plannedVisitId !== null).map(row => [row.plannedVisitId!, row]));
  const planned = currentRows.map(({ plan, item }) => {
    const priorAnswer = dayStatuses.find(row => row.plannedVisitId !== item.id && row.customerName.trim().toLocaleLowerCase("en-IN") === item.customerName.trim().toLocaleLowerCase("en-IN") && row.originalPlannedDate === item.plannedDate && row.status !== "Planned");
    const movedRow = movedForCurrent.get(item.id);
    const completedOn = history.find(row => row.status === "Visited")?.visitDate;
    return { id: item.id, plannedVisitId: priorAnswer?.plannedVisitId ?? item.id, customerName: item.customerName, location: item.location, purpose: item.purpose, plannedDate: item.plannedDate, movedFrom: movedRow?.originalPlannedDate ?? null, planVersion: plan.version, parentStatusId: movedRow?.id, completedOn: completedOn === date ? null : completedOn };
  });
  return { planned, moved: moved.filter(row => !planned.some(item => item.plannedVisitId === row.plannedVisitId)).map(row => ({ id: row.id, plannedVisitId: row.plannedVisitId, customerName: row.customerName, location: row.location, purpose: row.purpose, plannedDate: row.originalPlannedDate ?? row.visitDate, movedFrom: row.originalPlannedDate ?? row.visitDate, planVersion: 0, status: row.status, newDate: row.newDate })), statuses: dayStatuses };
}

export type DailyVisitAction = z.infer<typeof dailyVisitActionSchema>;
export async function saveDailyVisitAction(input: DailyVisitAction & { empCode: string; employeeName: string }) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    if (input.source === "Planned" && input.plannedVisitId) {
      const [linked] = await tx.select({ item: monthlyPlanItems, plan: monthlyPlans }).from(monthlyPlanItems).innerJoin(monthlyPlans, eq(monthlyPlans.id, monthlyPlanItems.planId)).where(eq(monthlyPlanItems.id, input.plannedVisitId)).limit(1);
      if (!linked || linked.plan.empCode !== input.empCode || linked.item.customerName.trim().toLocaleLowerCase("en-IN") !== input.customerName.trim().toLocaleLowerCase("en-IN")) throw new Error("This planned visit does not belong to your employee account.");
      if (input.parentStatusId) {
        const [parent] = await tx.select().from(dailyVisitStatuses).where(and(eq(dailyVisitStatuses.id, input.parentStatusId), eq(dailyVisitStatuses.empCode, input.empCode), eq(dailyVisitStatuses.plannedVisitId, input.plannedVisitId), eq(dailyVisitStatuses.visitDate, input.visitDate))).limit(1);
        if (!parent) throw new Error("This moved visit is not linked to your daily plan.");
      } else if (linked.item.plannedDate !== input.visitDate) throw new Error("The selected plan item is scheduled for a different day.");
    }
    if (input.mergeIntoPlannedVisitId) {
      const [mergeTarget] = await tx.select({ item: monthlyPlanItems, plan: monthlyPlans }).from(monthlyPlanItems).innerJoin(monthlyPlans, eq(monthlyPlans.id, monthlyPlanItems.planId)).where(eq(monthlyPlanItems.id, input.mergeIntoPlannedVisitId)).limit(1);
      if (!mergeTarget || mergeTarget.plan.empCode !== input.empCode || mergeTarget.item.plannedDate !== input.visitDate || mergeTarget.item.customerName.trim().toLocaleLowerCase("en-IN") !== input.customerName.trim().toLocaleLowerCase("en-IN")) throw new Error("The merged planned visit is not on your plan for this day.");
    }
    if (input.plannedVisitId) {
      if (input.status === "Visited") {
        const [alreadyVisited] = await tx.select().from(dailyVisitStatuses).where(and(eq(dailyVisitStatuses.empCode, input.empCode), eq(dailyVisitStatuses.plannedVisitId, input.plannedVisitId), eq(dailyVisitStatuses.status, "Visited"))).limit(1);
        if (alreadyVisited) throw new Error("This planned visit is already recorded as visited.");
      }
      const [existing] = await tx.select().from(dailyVisitStatuses).where(and(eq(dailyVisitStatuses.empCode, input.empCode), eq(dailyVisitStatuses.plannedVisitId, input.plannedVisitId), eq(dailyVisitStatuses.visitDate, input.visitDate))).limit(1);
      if (existing && existing.status !== "Planned") throw new Error("This planned visit already has a daily response.");
    } else {
      const [existing] = await tx.select().from(dailyVisitStatuses).where(and(eq(dailyVisitStatuses.empCode, input.empCode), eq(dailyVisitStatuses.visitDate, input.visitDate), eq(dailyVisitStatuses.source, "Unplanned"), eq(dailyVisitStatuses.customerName, input.customerName))).limit(1);
      if (existing) throw new Error("This customer already has a daily response for this day.");
    }
    let visitId: number | null = null;
    let followUpId: number | null = null;
    if (input.status === "Visited") {
      const existingMerged = input.mergeIntoPlannedVisitId ? (await tx.select().from(dailyVisitStatuses).where(and(eq(dailyVisitStatuses.empCode, input.empCode), eq(dailyVisitStatuses.plannedVisitId, input.mergeIntoPlannedVisitId), eq(dailyVisitStatuses.visitDate, input.visitDate), eq(dailyVisitStatuses.status, "Visited"))).limit(1))[0] : undefined;
      if (existingMerged?.visitId) visitId = existingMerged.visitId;
      else {
        const [createdVisit] = await tx.insert(visits).values({ empCode: input.empCode, employeeName: input.employeeName, visitDate: input.visitDate, customerName: input.customerName, location: input.location, purpose: input.purpose, travelMode: "Own Vehicle", distanceKm: "0.00", travelCost: "0.00", outcome: input.outcome || "Completed", notes: input.notes || null, source: input.source === "Unplanned" ? "Unplanned" : "Planned" });
        visitId = Number((createdVisit as { insertId?: number }).insertId);
      }
      if (input.followUpDate) {
        const [createdFollowUp] = await tx.insert(followUps).values({ visitId, empCode: input.empCode, customerName: input.customerName, followUpDate: input.followUpDate, followUpTime: input.followUpTime ?? null, followUpPurpose: input.followUpPurpose || null, note: input.notes || null, status: "Pending" });
        followUpId = Number((createdFollowUp as { insertId?: number }).insertId);
      }
    }
    if (input.completeFollowUpId) await tx.update(followUps).set({ status: "Done", completedAt: new Date(), completedVisitId: visitId }).where(and(eq(followUps.id, input.completeFollowUpId), eq(followUps.empCode, input.empCode)));
    const existing = input.plannedVisitId ? (await tx.select().from(dailyVisitStatuses).where(and(eq(dailyVisitStatuses.empCode, input.empCode), eq(dailyVisitStatuses.plannedVisitId, input.plannedVisitId), eq(dailyVisitStatuses.visitDate, input.visitDate), eq(dailyVisitStatuses.status, "Planned"))).limit(1))[0] : undefined;
    let statusId: number;
    const statusValues = { empCode: input.empCode, employeeName: input.employeeName, visitDate: input.visitDate, originalPlannedDate: input.originalPlannedDate ?? (input.source === "Planned" ? input.visitDate : null), plannedVisitId: input.plannedVisitId ?? null, parentStatusId: existing?.parentStatusId ?? null, mergedIntoStatusId: null as number | null, customerName: input.customerName, location: input.location, purpose: input.purpose, source: input.source, status: input.status, reason: input.reason ?? null, outcome: input.outcome || null, notes: input.notes || null, newDate: input.status === "Rescheduled" ? input.newDate ?? null : null, visitId, followUpId, lateEntry: input.lateEntry };
    if (existing) { await tx.update(dailyVisitStatuses).set(statusValues).where(eq(dailyVisitStatuses.id, existing.id)); statusId = existing.id; }
    else { const [createdStatus] = await tx.insert(dailyVisitStatuses).values(statusValues); statusId = Number((createdStatus as { insertId?: number }).insertId); }
    if (input.mergeIntoPlannedVisitId) {
      const [mergedStatus] = await tx.select().from(dailyVisitStatuses).where(and(eq(dailyVisitStatuses.empCode, input.empCode), eq(dailyVisitStatuses.plannedVisitId, input.mergeIntoPlannedVisitId), eq(dailyVisitStatuses.visitDate, input.visitDate))).limit(1);
      const mergedValues = { ...statusValues, plannedVisitId: input.mergeIntoPlannedVisitId, mergedIntoStatusId: statusId, visitId };
      if (mergedStatus) await tx.update(dailyVisitStatuses).set(mergedValues).where(eq(dailyVisitStatuses.id, mergedStatus.id));
      else await tx.insert(dailyVisitStatuses).values(mergedValues);
    }
    if (input.status === "Rescheduled" && input.newDate) await tx.insert(dailyVisitStatuses).values({ empCode: input.empCode, employeeName: input.employeeName, visitDate: input.newDate, originalPlannedDate: input.originalPlannedDate ?? input.visitDate, plannedVisitId: input.plannedVisitId ?? null, parentStatusId: statusId, customerName: input.customerName, location: input.location, purpose: input.purpose, source: input.source, status: "Planned", reason: input.reason ?? "Rescheduled", lateEntry: false });
    return { id: statusId, visitId, followUpId };
  });
}

export async function listDailyVisitStatuses(filter: { from?: string; to?: string; empCode?: string }) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const conditions = [filter.empCode ? eq(dailyVisitStatuses.empCode, filter.empCode) : undefined, filter.from ? gte(dailyVisitStatuses.visitDate, filter.from) : undefined, filter.to ? lte(dailyVisitStatuses.visitDate, filter.to) : undefined].filter(Boolean);
  const statusRows = or(eq(dailyVisitStatuses.status, "Missed"), eq(dailyVisitStatuses.status, "Rescheduled"), and(eq(dailyVisitStatuses.status, "Planned"), isNotNull(dailyVisitStatuses.parentStatusId))!, eq(dailyVisitStatuses.source, "Unplanned"))!;
  return db.select().from(dailyVisitStatuses).where(conditions.length ? and(...conditions, statusRows) : statusRows).orderBy(asc(dailyVisitStatuses.visitDate), asc(dailyVisitStatuses.id));
}

export async function listDailyVisitWorkload(filter: { from: string; to: string; empCode?: string }) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const monthFrom = filter.from.slice(0, 7); const monthTo = filter.to.slice(0, 7);
  const planHeaders = await db.select().from(monthlyPlans).where(and(gte(monthlyPlans.planMonth, monthFrom), lte(monthlyPlans.planMonth, monthTo), eq(monthlyPlans.status, "Submitted"), filter.empCode ? eq(monthlyPlans.empCode, filter.empCode) : undefined));
  const planIds = planHeaders.map(plan => plan.id);
  const planRows = planIds.length ? await db.select({ plan: monthlyPlans, item: monthlyPlanItems }).from(monthlyPlanItems).innerJoin(monthlyPlans, eq(monthlyPlans.id, monthlyPlanItems.planId)).where(inArray(monthlyPlanItems.planId, planIds)) : [];
  const moved = await db.select().from(dailyVisitStatuses).where(and(gte(dailyVisitStatuses.visitDate, filter.from), lte(dailyVisitStatuses.visitDate, filter.to), isNotNull(dailyVisitStatuses.parentStatusId), eq(dailyVisitStatuses.source, "Planned"), filter.empCode ? eq(dailyVisitStatuses.empCode, filter.empCode) : undefined));
  const totals = new Map<string, { date: string; empCode: string; employeeName: string; ids: Set<string> }>();
  const add = (date: string, empCode: string, employeeName: string, id: string) => { const key = `${empCode}\u0000${date}`; const row = totals.get(key) ?? { date, empCode, employeeName, ids: new Set<string>() }; row.ids.add(id); totals.set(key, row); };
  for (const { plan, item } of planRows) if (item.version === plan.version && item.plannedDate >= filter.from && item.plannedDate <= filter.to) add(item.plannedDate, plan.empCode, plan.employeeName, `planned:${item.id}`);
  for (const item of moved) add(item.visitDate, item.empCode, item.employeeName, `planned:${item.plannedVisitId ?? item.id}`);
  return [...totals.values()].map(row => ({ date: row.date, empCode: row.empCode, employeeName: row.employeeName, plannedVisits: row.ids.size, overloaded: row.ids.size > 5 })).sort((a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName));
}
