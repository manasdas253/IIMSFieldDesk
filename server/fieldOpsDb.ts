import { and, count, desc, eq, gte, inArray, lte, like, or, type SQL } from "drizzle-orm";
import { getDb } from "./db";
import { employees, plannedVisits, visits, weeklyPlans } from "../drizzle/schema";
import type { PlanInput, PlanItemInput, VisitInput } from "../shared/fieldOps";

function visitWhere(filters: { from?: string; to?: string; employeeName?: string; location?: string; purpose?: string; search?: string }) {
  const conditions: SQL[] = [];
  if (filters.from) conditions.push(gte(visits.visitDate, filters.from));
  if (filters.to) conditions.push(lte(visits.visitDate, filters.to));
  if (filters.employeeName) conditions.push(eq(visits.employeeName, filters.employeeName));
  if (filters.location) conditions.push(like(visits.location, `%${filters.location}%`));
  if (filters.purpose) conditions.push(eq(visits.purpose, filters.purpose as typeof visits.purpose.enumValues[number]));
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(or(like(visits.employeeName, pattern), like(visits.customerName, pattern), like(visits.location, pattern), like(visits.outcome, pattern))!);
  }
  return conditions.length ? and(...conditions) : undefined;
}

export async function listVisits(filters: { from?: string; to?: string; employeeName?: string; location?: string; purpose?: string; search?: string } = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const where = visitWhere(filters);
  return db.select().from(visits).where(where).orderBy(desc(visits.visitDate), desc(visits.createdAt)).limit(5000);
}

export async function countVisitsThrough(to: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [row] = await db.select({ total: count() }).from(visits).where(lte(visits.visitDate, to));
  return Number(row?.total ?? 0);
}

export async function listVisitsThroughPage(to: string, page: number, pageSize: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(visits).where(lte(visits.visitDate, to)).orderBy(desc(visits.visitDate), desc(visits.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
}

export async function getVisit(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [row] = await db.select().from(visits).where(eq(visits.id, id)).limit(1);
  return row ?? null;
}

export async function createVisit(input: VisitInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [employee] = await db.select().from(employees).where(and(eq(employees.empCode, input.empCode), eq(employees.isActive, true))).limit(1);
  if (!employee) throw new Error("Emp Code is unknown or inactive.");
  const [result] = await db.insert(visits).values({ ...input, employeeName: employee.employeeName, distanceKm: input.distanceKm.toFixed(2), travelCost: input.travelCost.toFixed(2), notes: input.notes || null });
  const id = Number((result as { insertId?: number }).insertId);
  return getVisit(id);
}

export async function updateVisit(id: number, input: VisitInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [employee] = await db.select().from(employees).where(and(eq(employees.empCode, input.empCode), eq(employees.isActive, true))).limit(1);
  if (!employee) throw new Error("Emp Code is unknown or inactive.");
  await db.update(visits).set({ ...input, employeeName: employee.employeeName, distanceKm: input.distanceKm.toFixed(2), travelCost: input.travelCost.toFixed(2), notes: input.notes || null }).where(eq(visits.id, id));
  return getVisit(id);
}

export async function deleteVisit(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(visits).where(eq(visits.id, id));
  return { success: true as const };
}

async function writePlan(input: PlanInput, id?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [employee] = await db.select().from(employees).where(and(eq(employees.empCode, input.empCode), eq(employees.isActive, true))).limit(1);
  if (!employee) throw new Error("Emp Code is unknown or inactive.");
  return db.transaction(async tx => {
    let planId = id;
    if (planId) {
      await tx.update(weeklyPlans).set({ empCode: employee.empCode, employeeName: employee.employeeName, weekStartingDate: input.weekStartingDate }).where(eq(weeklyPlans.id, planId));
      await tx.delete(plannedVisits).where(eq(plannedVisits.planId, planId));
    } else {
      const [result] = await tx.insert(weeklyPlans).values({ empCode: employee.empCode, employeeName: employee.employeeName, weekStartingDate: input.weekStartingDate });
      planId = Number((result as { insertId?: number }).insertId);
    }
    await tx.insert(plannedVisits).values(input.items.map(item => ({
      planId: planId!, customerName: item.customerName, location: item.location, purpose: item.purpose,
      applyForTicket: item.applyForTicket, travelMode: item.applyForTicket ? item.travelMode ?? null : null,
      routeFrom: item.applyForTicket ? item.routeFrom ?? null : null, routeTo: item.applyForTicket ? item.routeTo ?? null : null,
      preferredDate: item.applyForTicket ? item.preferredDate ?? null : null,
    })));
    return planId!;
  });
}

export async function createPlan(input: PlanInput) {
  const id = await writePlan(input);
  return getPlan(id);
}

export async function updatePlan(id: number, input: PlanInput) {
  if (!(await getPlan(id))) return null;
  await writePlan(input, id);
  return getPlan(id);
}

export async function getPlan(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [header] = await db.select().from(weeklyPlans).where(eq(weeklyPlans.id, id)).limit(1);
  if (!header) return null;
  const items = await db.select().from(plannedVisits).where(eq(plannedVisits.planId, id)).orderBy(plannedVisits.id);
  return { ...header, items };
}

export async function listPlans(filters: { from?: string; to?: string; employeeName?: string } = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const conditions: SQL[] = [];
  if (filters.from) conditions.push(gte(weeklyPlans.weekStartingDate, filters.from));
  if (filters.to) conditions.push(lte(weeklyPlans.weekStartingDate, filters.to));
  if (filters.employeeName) conditions.push(eq(weeklyPlans.employeeName, filters.employeeName));
  const headers = await db.select().from(weeklyPlans).where(conditions.length ? and(...conditions) : undefined).orderBy(weeklyPlans.weekStartingDate, weeklyPlans.employeeName).limit(2000);
  if (!headers.length) return [];
  const ids = headers.map(plan => plan.id);
  const items = await db.select().from(plannedVisits).where(inArray(plannedVisits.planId, ids)).orderBy(plannedVisits.planId, plannedVisits.id);
  const grouped = new Map<number, typeof items>();
  for (const item of items) grouped.set(item.planId, [...(grouped.get(item.planId) ?? []), item]);
  return headers.map(header => ({ ...header, items: grouped.get(header.id) ?? [] }));
}

export async function deletePlan(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(weeklyPlans).where(eq(weeklyPlans.id, id));
  return { success: true as const };
}

export async function getRecentVisits(limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(visits).orderBy(desc(visits.visitDate), desc(visits.createdAt)).limit(limit);
}

export async function getEmployeeNames() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const visitNames = await db.selectDistinct({ name: visits.employeeName }).from(visits).orderBy(visits.employeeName);
  const planNames = await db.selectDistinct({ name: weeklyPlans.employeeName }).from(weeklyPlans).orderBy(weeklyPlans.employeeName);
  return [...new Set([...visitNames, ...planNames].map(row => row.name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export type PlanPayload = PlanInput;
export type PlanItemPayload = PlanItemInput;
