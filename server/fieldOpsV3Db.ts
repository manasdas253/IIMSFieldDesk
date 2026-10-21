import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { employees, followUps, monthlyPlanItems, monthlyPlans, planHolidays, visits } from "../drizzle/schema";
import type { EmployeeInput, FollowUpInput, MonthlyPlanSubmitInput } from "../shared/fieldOps";
import { getDb } from "./db";

export async function listEmployeeMaster(includeInactive = true) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  return db.select().from(employees).where(includeInactive ? undefined : eq(employees.isActive, true)).orderBy(asc(employees.empCode));
}
export async function createEmployee(input: EmployeeInput) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await db.insert(employees).values({ ...input, empCode: input.empCode.trim().toUpperCase(), designation: input.designation || null, department: input.department || null, mobile: input.mobile || null });
  const [row] = await db.select().from(employees).where(eq(employees.empCode, input.empCode.trim().toUpperCase())).limit(1);
  return row;
}
export async function updateEmployee(id: number, input: EmployeeInput) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await db.update(employees).set({ ...input, empCode: input.empCode.trim().toUpperCase(), designation: input.designation || null, department: input.department || null, mobile: input.mobile || null }).where(eq(employees.id, id));
  const [row] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
  return row ?? null;
}
export async function setEmployeeActive(empCode: string, isActive: boolean) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await db.update(employees).set({ isActive }).where(eq(employees.empCode, empCode));
  const [row] = await db.select().from(employees).where(eq(employees.empCode, empCode)).limit(1);
  return row ?? null;
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
    if (existing) {
      planId = existing.id;
      await tx.delete(monthlyPlanItems).where(eq(monthlyPlanItems.planId, planId));
      await tx.update(monthlyPlans).set({ employeeName: employee.employeeName, status: "Submitted", version, submittedAt: new Date() }).where(eq(monthlyPlans.id, planId));
    } else {
      const [created] = await tx.insert(monthlyPlans).values({ empCode: employee.empCode, employeeName: employee.employeeName, planMonth: input.planMonth, status: "Submitted", version, submittedAt: new Date() });
      planId = Number((created as { insertId?: number }).insertId);
    }
    if (input.items.length) await tx.insert(monthlyPlanItems).values(input.items.map(item => ({ planId, plannedDate: item.plannedDate, customerName: item.customerName, location: item.location, purpose: item.purpose, applyForTicket: item.applyForTicket, travelMode: item.applyForTicket ? item.travelMode ?? null : null, routeFrom: item.applyForTicket ? item.routeFrom ?? null : null, routeTo: item.applyForTicket ? item.routeTo ?? null : null, preferredDate: item.applyForTicket ? item.preferredDate ?? null : null, remarks: item.remarks || null })));
    return { id: planId, empCode: employee.empCode, employeeName: employee.employeeName, planMonth: input.planMonth, version, status: "Submitted" as const };
  });
}
export async function listMonthlyPlanReport(month: string, empCode?: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const roster = await db.select().from(employees).where(empCode ? eq(employees.empCode, empCode) : undefined).orderBy(asc(employees.empCode));
  if (!roster.length) return [];
  const plans = await db.select().from(monthlyPlans).where(and(eq(monthlyPlans.planMonth, month), empCode ? eq(monthlyPlans.empCode, empCode) : undefined));
  const planIds = plans.map(plan => plan.id);
  const items = planIds.length ? await db.select().from(monthlyPlanItems).where(inArray(monthlyPlanItems.planId, planIds)).orderBy(asc(monthlyPlanItems.plannedDate), asc(monthlyPlanItems.id)) : [];
  const planByCode = new Map(plans.map(plan => [plan.empCode, plan]));
  const itemsByPlan = new Map<number, typeof items>();
  items.forEach(item => itemsByPlan.set(item.planId, [...(itemsByPlan.get(item.planId) ?? []), item]));
  return roster.map(employee => {
    const plan = planByCode.get(employee.empCode);
    const planItems = plan ? itemsByPlan.get(plan.id) ?? [] : [];
    return { empCode: employee.empCode, name: employee.employeeName, month, status: plan?.status ?? "Not submitted", version: plan?.version ?? 0, plannedVisits: planItems.length, distinctCustomers: new Set(planItems.map(item => item.customerName.trim().toLocaleLowerCase("en-IN"))).size, ticketsRequested: planItems.filter(item => item.applyForTicket).length, planItems, plan };
  });
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
