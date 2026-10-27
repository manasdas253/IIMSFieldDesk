import { and, eq, gte, lte } from "drizzle-orm";
import { employees, followUps, monthlyPlanItems, monthlyPlans, planHolidays, visits } from "../../../drizzle/schema";
import { currentMonthlyPlanItems, monthlyPlanSheetDataSchema, type MonthlyPlanSheetData } from "../../../shared/fieldOps";
import { getDb } from "../../db";

export type SheetEmployee = { empCode: string; employeeName: string; designation: string | null; department: string | null };
export type SheetPlan = { version: number; status: "Draft" | "Submitted"; submittedAt: Date | string | null } | null;
export type SheetItem = { plannedDate: string; customerName: string; location: string; purpose: string; remarks: string | null; applyForTicket: boolean; preferredDate?: string | null };
export type SheetHoliday = { holidayDate: string; name: string };
export type SheetActual = { empCode: string | null; customerName: string; visitDate: string };

function istTimestamp(now: Date) {
  const pieces = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const get = (type: string) => pieces.find(part => part.type === type)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")}, ${get("hour")}:${get("minute")} IST`;
}
function dateForMonth(month: string, day: number) { return `${month}-${String(day).padStart(2, "0")}`; }
function monthDayCount(month: string) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 0)).getUTCDate();
}
function dateDayName(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
function normalizedCustomer(value: string) { return value.trim().toLocaleLowerCase("en-IN"); }

/** Pure builder shared by PDF, Excel, and the live preview. */
export function buildMonthlyPlanSheetData(args: {
  month: string;
  generatedAt?: Date;
  employee: SheetEmployee;
  plan: SheetPlan;
  items?: SheetItem[];
  holidays?: SheetHoliday[];
  actualVisits?: SheetActual[];
  visited?: boolean;
}): MonthlyPlanSheetData {
  const { month, employee, plan } = args;
  const grouped = new Map<string, SheetItem[]>();
  for (const item of args.items ?? []) {
    if (!item.plannedDate.startsWith(`${month}-`)) continue;
    grouped.set(item.plannedDate, [...(grouped.get(item.plannedDate) ?? []), item]);
  }
  const holidayByDate = new Map((args.holidays ?? []).map(holiday => [holiday.holidayDate, holiday.name]));
  const actualCustomers = new Set((args.actualVisits ?? []).filter(row => row.empCode === employee.empCode).map(row => `${row.visitDate}\u0000${normalizedCustomer(row.customerName)}`));
  const days = Array.from({ length: monthDayCount(month) }, (_, offset) => {
    const date = dateForMonth(month, offset + 1);
    const itemsForDay = grouped.get(date) ?? [];
    const holidayName = holidayByDate.get(date);
    const d = new Date(`${date}T12:00:00Z`);
    const isSunday = d.getUTCDay() === 0;
    const rows = itemsForDay.length
      ? itemsForDay.map(item => ({ customer: item.customerName, location: item.location, purpose: item.purpose, remarks: item.remarks ?? item.purpose, ticket: item.applyForTicket, ...(args.visited ? { visited: actualCustomers.has(`${date}\u0000${normalizedCustomer(item.customerName)}`) } : {}) }))
      : [{ customer: "", location: "", purpose: "", remarks: "" }];
    return { date, dayName: dateDayName(date), isSunday, isHoliday: Boolean(holidayName), ...(holidayName ? { holidayName } : {}), rows };
  });
  const allRows = days.flatMap(day => day.rows).filter(row => row.customer.trim());
  const plannedDays = new Set(days.filter(day => day.rows.some(row => row.customer.trim()) && !day.isSunday && !day.isHoliday).map(day => day.date));
  const data = {
    month,
    generatedAtIst: istTimestamp(args.generatedAt ?? new Date()),
    employee: { empCode: employee.empCode, name: employee.employeeName, designation: employee.designation ?? "", department: employee.department ?? "" },
    plan: plan ? { version: plan.version, status: plan.status, submittedAt: plan.submittedAt ? istTimestamp(new Date(plan.submittedAt)) : null } : null,
    days,
    totals: {
      plannedVisits: allRows.length,
      distinctCustomers: new Set(allRows.map(row => normalizedCustomer(row.customer))).size,
      workingDaysWithPlan: plannedDays.size,
      sundaysAndHolidays: days.filter(day => day.isSunday || day.isHoliday).length,
      tickets: allRows.filter(row => "ticket" in row && row.ticket).length,
    },
  };
  return monthlyPlanSheetDataSchema.parse(data);
}

/** Fetch once, then build every requested sheet from this shared data contract. */
export async function loadMonthlyPlanSheetData(month: string, empCode: string | "ALL", options: { visited?: boolean; blank?: boolean } = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const roster = await db.select().from(employees).where(empCode === "ALL" ? undefined : eq(employees.empCode, empCode));
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(monthDayCount(month)).padStart(2, "0")}`;
  const holidays = await db.select().from(planHolidays).where(and(gte(planHolidays.holidayDate, monthStart), lte(planHolidays.holidayDate, monthEnd)));
  const built = await Promise.all(roster.map(async employee => {
    const [planHeader] = options.blank ? [] : await db.select().from(monthlyPlans).where(and(eq(monthlyPlans.empCode, employee.empCode), eq(monthlyPlans.planMonth, month))).limit(1);
    const allPlanItems = planHeader ? await db.select().from(monthlyPlanItems).where(eq(monthlyPlanItems.planId, planHeader.id)).orderBy(monthlyPlanItems.plannedDate, monthlyPlanItems.id) : [];
    const planItems = planHeader ? currentMonthlyPlanItems(allPlanItems, planHeader.version) : [];
    const actualRows = options.visited ? await db.select({ empCode: visits.empCode, customerName: visits.customerName, visitDate: visits.visitDate }).from(visits).where(and(eq(visits.empCode, employee.empCode), gte(visits.visitDate, monthStart), lte(visits.visitDate, monthEnd))) : [];
    return buildMonthlyPlanSheetData({ month, employee, plan: planHeader ? { version: planHeader.version, status: planHeader.status, submittedAt: planHeader.submittedAt } : null, items: planItems, holidays, actualVisits: actualRows, visited: options.visited });
  }));
  return built;
}
