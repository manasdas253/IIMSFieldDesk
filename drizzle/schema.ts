import { boolean, date, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { TRAVEL_MODES, VISIT_PURPOSES } from "../shared/fieldOps";

/** Retained starter table for a future identity integration; unused in Phase 1. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  empCode: varchar("empCode", { length: 20 }).notNull(),
  employeeName: varchar("employeeName", { length: 120 }).notNull(),
  designation: varchar("designation", { length: 120 }),
  department: varchar("department", { length: 120 }),
  mobile: varchar("mobile", { length: 32 }),
  role: mysqlEnum("role", ["employee", "admin"]).notNull().default("employee"),
  passwordHash: varchar("passwordHash", { length: 255 }),
  mustChangePassword: boolean("mustChangePassword").notNull().default(true),
  lastLoginAt: timestamp("lastLoginAt"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("employees_empCode_uq").on(table.empCode), index("employees_active_idx").on(table.isActive)]);

export const visits = mysqlTable("field_visits", {
  id: int("id").autoincrement().primaryKey(),
  empCode: varchar("empCode", { length: 20 }),
  employeeName: varchar("employeeName", { length: 120 }).notNull(),
  visitDate: date("visitDate", { mode: "string" }).notNull(),
  customerName: varchar("customerName", { length: 180 }).notNull(),
  visitedPersonName: varchar("visitedPersonName", { length: 120 }),
  location: varchar("location", { length: 160 }).notNull(),
  purpose: mysqlEnum("purpose", VISIT_PURPOSES).notNull(),
  travelMode: mysqlEnum("travelMode", TRAVEL_MODES).notNull(),
  distanceKm: decimal("distanceKm", { precision: 10, scale: 2 }).notNull().default("0"),
  travelCost: decimal("travelCost", { precision: 12, scale: 2 }).notNull().default("0"),
  outcome: varchar("outcome", { length: 80 }).notNull(),
  notes: text("notes"),
  /** Optional source tag; legacy rows remain NULL. */
  source: mysqlEnum("source", ["Planned", "Unplanned"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("field_visits_empCode_idx").on(table.empCode)]);

/** Append-only daily answers and reschedule history. Actual visit reports continue to read field_visits. */
export const dailyVisitStatuses = mysqlTable("daily_visit_statuses", {
  id: int("id").autoincrement().primaryKey(),
  empCode: varchar("empCode", { length: 20 }).notNull(),
  employeeName: varchar("employeeName", { length: 120 }).notNull(),
  visitDate: date("visitDate", { mode: "string" }).notNull(),
  originalPlannedDate: date("originalPlannedDate", { mode: "string" }),
  // Kept as a historical reference without FK cascade: monthly plan replacement must not erase daily history.
  plannedVisitId: int("plannedVisitId"),
  parentStatusId: int("parentStatusId"),
  customerName: varchar("customerName", { length: 180 }).notNull(),
  location: varchar("location", { length: 160 }).notNull(),
  purpose: mysqlEnum("purpose", VISIT_PURPOSES).notNull(),
  source: mysqlEnum("source", ["Planned", "Unplanned"]).notNull().default("Planned"),
  status: mysqlEnum("status", ["Planned", "Visited", "Missed", "Rescheduled"]).notNull(),
  reason: mysqlEnum("reason", ["Customer unavailable", "Rescheduled", "Internal work", "Leave", "Other"]),
  outcome: varchar("outcome", { length: 80 }),
  notes: text("notes"),
  newDate: date("newDate", { mode: "string" }),
  visitId: int("visitId"),
  followUpId: int("followUpId"),
  lateEntry: boolean("lateEntry").notNull().default(false),
  mergedIntoStatusId: int("mergedIntoStatusId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("daily_status_visit_day_uq").on(table.empCode, table.plannedVisitId, table.visitDate), index("daily_status_emp_date_idx").on(table.empCode, table.visitDate), index("daily_status_planned_visit_idx").on(table.plannedVisitId), index("daily_status_parent_idx").on(table.parentStatusId)]);

export const weeklyPlans = mysqlTable("weekly_plans", {
  id: int("id").autoincrement().primaryKey(),
  empCode: varchar("empCode", { length: 20 }),
  employeeName: varchar("employeeName", { length: 120 }).notNull(),
  weekStartingDate: date("weekStartingDate", { mode: "string" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("weekly_plans_empCode_idx").on(table.empCode)]);

export const plannedVisits = mysqlTable("planned_visits", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull().references(() => weeklyPlans.id, { onDelete: "cascade" }),
  customerName: varchar("customerName", { length: 180 }).notNull(),
  location: varchar("location", { length: 160 }).notNull(),
  purpose: mysqlEnum("purpose", VISIT_PURPOSES).notNull(),
  applyForTicket: boolean("applyForTicket").notNull().default(false),
  travelMode: mysqlEnum("travelMode", TRAVEL_MODES),
  routeFrom: varchar("routeFrom", { length: 120 }),
  routeTo: varchar("routeTo", { length: 120 }),
  preferredDate: date("preferredDate", { mode: "string" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const monthlyPlans = mysqlTable("monthly_plans", {
  id: int("id").autoincrement().primaryKey(),
  empCode: varchar("empCode", { length: 20 }).notNull(),
  employeeName: varchar("employeeName", { length: 120 }).notNull(),
  planMonth: varchar("planMonth", { length: 7 }).notNull(),
  status: mysqlEnum("status", ["Draft", "Submitted"]).notNull().default("Submitted"),
  version: int("version").notNull().default(1),
  submittedAt: timestamp("submittedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("monthly_plans_emp_month_uq").on(table.empCode, table.planMonth), index("monthly_plans_month_idx").on(table.planMonth)]);

export const monthlyPlanItems = mysqlTable("monthly_plan_items", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull().references(() => monthlyPlans.id, { onDelete: "cascade" }),
  version: int("version").notNull().default(1),
  plannedDate: date("plannedDate", { mode: "string" }).notNull(),
  customerName: varchar("customerName", { length: 180 }).notNull(),
  location: varchar("location", { length: 160 }).notNull(),
  purpose: mysqlEnum("purpose", VISIT_PURPOSES).notNull(),
  applyForTicket: boolean("applyForTicket").notNull().default(false),
  travelMode: mysqlEnum("travelMode", TRAVEL_MODES),
  routeFrom: varchar("routeFrom", { length: 120 }),
  routeTo: varchar("routeTo", { length: 120 }),
  preferredDate: date("preferredDate", { mode: "string" }),
  remarks: text("remarks"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("monthly_items_plan_date_idx").on(table.planId, table.plannedDate)]);

export const followUps = mysqlTable("follow_ups", {
  id: int("id").autoincrement().primaryKey(),
  visitId: int("visitId").notNull().references(() => visits.id, { onDelete: "cascade" }),
  empCode: varchar("empCode", { length: 20 }),
  customerName: varchar("customerName", { length: 180 }).notNull(),
  followUpDate: date("followUpDate", { mode: "string" }).notNull(),
  followUpTime: varchar("followUpTime", { length: 8 }),
  followUpPurpose: varchar("followUpPurpose", { length: 500 }),
  note: text("note"),
  status: mysqlEnum("status", ["Pending", "Done", "Rescheduled", "Cancelled"]).notNull().default("Pending"),
  completedAt: timestamp("completedAt"),
  completedVisitId: int("completedVisitId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("followups_emp_date_status_idx").on(table.empCode, table.followUpDate, table.status)]);

export const planHolidays = mysqlTable("plan_holidays", {
  id: int("id").autoincrement().primaryKey(),
  holidayDate: date("holidayDate", { mode: "string" }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("plan_holidays_date_uq").on(table.holidayDate)]);

export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  empCode: varchar("empCode", { length: 20 }).notNull(),
  endpoint: varchar("endpoint", { length: 500 }).notNull(),
  p256dh: varchar("p256dh", { length: 255 }).notNull(),
  auth: varchar("auth", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("push_subscriptions_endpoint_uq").on(table.endpoint), index("push_subscriptions_emp_idx").on(table.empCode)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Visit = typeof visits.$inferSelect;
export type InsertVisit = typeof visits.$inferInsert;
export type WeeklyPlan = typeof weeklyPlans.$inferSelect;
export type PlannedVisit = typeof plannedVisits.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type MonthlyPlan = typeof monthlyPlans.$inferSelect;
export type MonthlyPlanItem = typeof monthlyPlanItems.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;
export type PlanHoliday = typeof planHolidays.$inferSelect;
