import { z } from "zod";

export const VISIT_PURPOSES = ["New Lead", "Follow-up", "Service", "Collection", "Other"] as const;
export const TRAVEL_MODES = ["Own Vehicle", "Train", "Flight", "Cab", "Other"] as const;
export const VISIT_OUTCOMES = ["Positive", "Pending", "No Response", "Closed"] as const;

export type VisitPurpose = (typeof VISIT_PURPOSES)[number];
export type TravelMode = (typeof TRAVEL_MODES)[number];
export type VisitOutcome = (typeof VISIT_OUTCOMES)[number];

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.");
const mondayDate = dateOnly.refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1;
}, "Choose a Monday as the week starting date.");
const requiredText = (label: string, max = 180) => z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

export const visitInputSchema = z.object({
  empCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,20}$/, "Select an active Emp Code."),
  employeeName: requiredText("Employee name", 120),
  visitDate: dateOnly,
  customerName: requiredText("Customer name"),
  location: requiredText("Location", 160),
  purpose: z.enum(VISIT_PURPOSES),
  travelMode: z.enum(TRAVEL_MODES).optional().default("Own Vehicle"),
  distanceKm: z.number().min(0, "Distance cannot be negative.").max(100000).optional().default(0),
  travelCost: z.number().min(0, "Travel cost cannot be negative.").max(100000000).optional().default(0),
  outcome: z.string().trim().min(1, "Add a visit outcome.").max(80),
  notes: z.string().max(4000).optional().default(""),
});

export const planItemInputSchema = z.object({
  customerName: requiredText("Customer name"),
  location: requiredText("Location", 160),
  purpose: z.enum(VISIT_PURPOSES),
  applyForTicket: z.boolean(),
  travelMode: z.enum(TRAVEL_MODES).nullable().optional(),
  routeFrom: z.string().trim().max(120).nullable().optional(),
  routeTo: z.string().trim().max(120).nullable().optional(),
  preferredDate: dateOnly.nullable().optional(),
}).superRefine((item, ctx) => {
  if (!item.applyForTicket) return;
  if (!item.travelMode) ctx.addIssue({ code: "custom", path: ["travelMode"], message: "Choose a travel mode for the ticket request." });
  if (!item.routeFrom?.trim()) ctx.addIssue({ code: "custom", path: ["routeFrom"], message: "Enter a departure location." });
  if (!item.routeTo?.trim()) ctx.addIssue({ code: "custom", path: ["routeTo"], message: "Enter an arrival location." });
  if (!item.preferredDate) ctx.addIssue({ code: "custom", path: ["preferredDate"], message: "Choose a preferred travel date." });
});

export const planInputSchema = z.object({
  empCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,20}$/, "Select an active Emp Code."),
  employeeName: requiredText("Employee name", 120),
  weekStartingDate: mondayDate,
  items: z.array(planItemInputSchema).min(1, "Add at least one planned customer."),
});

export const planUpdateSchema = planInputSchema.extend({ id: z.number().int().positive() });
export const visitUpdateSchema = visitInputSchema.extend({ id: z.number().int().positive() });

export const visitListFilterSchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  employeeName: z.string().trim().optional(),
  location: z.string().trim().optional(),
  purpose: z.enum(VISIT_PURPOSES).optional(),
  search: z.string().trim().optional(),
});

export const planListFilterSchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  employeeName: z.string().trim().optional(),
});

export type VisitInput = z.infer<typeof visitInputSchema>;
export type VisitRecord = VisitInput & { id: number; createdAt: Date; updatedAt: Date };
export type PlanItemInput = z.infer<typeof planItemInputSchema>;
export type PlanInput = z.infer<typeof planInputSchema>;
export type PlanRecord = {
  id: number;
  employeeName: string;
  weekStartingDate: string;
  createdAt: Date;
  updatedAt: Date;
  items: Array<PlanItemInput & { id: number; planId: number }>;
};

export function indiaDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function nextMondayDate(from = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(from);
  const year = Number(parts.find(p => p.type === "year")?.value);
  const month = Number(parts.find(p => p.type === "month")?.value);
  const day = Number(parts.find(p => p.type === "day")?.value);
  const local = new Date(Date.UTC(year, month - 1, day));
  const weekday = local.getUTCDay();
  const daysUntilMonday = weekday === 1 ? 7 : (8 - weekday) % 7;
  local.setUTCDate(local.getUTCDate() + daysUntilMonday);
  return local.toISOString().slice(0, 10);
}


export const empCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,20}$/, "Emp Code must be 3–20 letters, numbers, or hyphens.");
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a valid month in YYYY-MM format.");
export const employeeInputSchema = z.object({
  empCode: empCodeSchema,
  employeeName: requiredText("Employee name", 120),
  designation: z.string().trim().max(120).optional().default(""),
  department: z.string().trim().max(120).optional().default(""),
  mobile: z.string().trim().max(32).optional().default(""),
});
export const employeeUpdateSchema = employeeInputSchema.extend({ id: z.number().int().positive() });
export const employeeSetActiveSchema = z.object({ empCode: empCodeSchema, isActive: z.boolean() });
export const monthlyPlanItemInputSchema = z.object({
  plannedDate: dateOnly,
  customerName: requiredText("Customer name"),
  location: requiredText("Location", 160),
  purpose: z.enum(VISIT_PURPOSES),
  applyForTicket: z.boolean().default(false),
  travelMode: z.enum(TRAVEL_MODES).nullable().optional(),
  routeFrom: z.string().trim().max(120).nullable().optional(),
  routeTo: z.string().trim().max(120).nullable().optional(),
  preferredDate: dateOnly.nullable().optional(),
  remarks: z.string().max(4000).optional().default(""),
}).superRefine((item, ctx) => {
  if (!item.applyForTicket) return;
  if (!item.travelMode) ctx.addIssue({ code: "custom", path: ["travelMode"], message: "Choose a travel mode for the ticket request." });
  if (!item.routeFrom?.trim()) ctx.addIssue({ code: "custom", path: ["routeFrom"], message: "Enter a departure location." });
  if (!item.routeTo?.trim()) ctx.addIssue({ code: "custom", path: ["routeTo"], message: "Enter an arrival location." });
  if (!item.preferredDate) ctx.addIssue({ code: "custom", path: ["preferredDate"], message: "Choose a preferred travel date." });
});
export const monthlyPlanSubmitSchema = z.object({
  empCode: empCodeSchema,
  planMonth: monthSchema,
  items: z.array(monthlyPlanItemInputSchema),
  templateType: z.enum(["standard", "change"]).optional(),
  downloadedOn: dateOnly.optional(),
  basePlanVersion: z.number().int().nonnegative().optional(),
});
export const monthlyPlanSheetQuerySchema = z.object({
  month: monthSchema,
  empCode: z.union([empCodeSchema, z.literal("ALL")]),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  type: z.enum(["filled", "blank"]).default("filled"),
  visited: z.enum(["0", "1"]).default("0"),
  includeSundays: z.enum(["0", "1"]).default("1"),
});
export const holidayInputSchema = z.object({ holidayDate: dateOnly, name: requiredText("Holiday name", 160) });
export const followUpInputSchema = z.object({
  visitId: z.number().int().positive(),
  empCode: empCodeSchema.nullable().optional(),
  customerName: requiredText("Customer name"),
  followUpDate: dateOnly,
  followUpTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time.").optional().nullable(),
  followUpPurpose: z.string().trim().max(500).optional().default(""),
  note: z.string().max(4000).optional().default(""),
}).superRefine((item, ctx) => {
  const parsedDate = new Date(`${item.followUpDate}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== item.followUpDate) ctx.addIssue({ code: "custom", path: ["followUpDate"], message: "Enter a valid follow-up date." });
  if (item.followUpPurpose.trim().toLocaleLowerCase() === "visit" && !item.followUpTime) ctx.addIssue({ code: "custom", path: ["followUpTime"], message: "Choose a time for the scheduled visit." });
});
export const followUpListSchema = z.object({ empCode: empCodeSchema.optional(), status: z.enum(["Pending", "Done", "Rescheduled", "Cancelled"]).optional(), from: dateOnly.optional(), to: dateOnly.optional() });

export const dailyVisitActionSchema = z.object({
  visitDate: dateOnly,
  plannedVisitId: z.number().int().positive().nullable().optional(),
  mergeIntoPlannedVisitId: z.number().int().positive().nullable().optional(),
  parentStatusId: z.number().int().positive().nullable().optional(),
  originalPlannedDate: dateOnly.nullable().optional(),
  customerName: requiredText("Customer name"), visitedPersonName: z.string().trim().max(120).optional(), location: requiredText("Location", 160), purpose: z.enum(VISIT_PURPOSES),
  source: z.enum(["Planned", "Unplanned"]).default("Planned"),
  status: z.enum(["Visited", "Missed", "Rescheduled"]),
  reason: z.enum(["Customer unavailable", "Rescheduled", "Internal work", "Leave", "Other"]).nullable().optional(),
  newDate: dateOnly.nullable().optional(), outcome: z.string().trim().max(80).optional().default(""), notes: z.string().max(4000).optional().default(""),
  followUpDate: dateOnly.nullable().optional(), followUpTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(), followUpPurpose: z.string().max(500).optional().default(""),
  completeFollowUpId: z.number().int().positive().nullable().optional(),
  lateEntry: z.boolean().default(false),
}).superRefine((item, ctx) => {
  if (item.source === "Planned" && !item.plannedVisitId) ctx.addIssue({ code: "custom", path: ["plannedVisitId"], message: "Link this response to a planned visit." });
  if (item.source === "Unplanned" && item.plannedVisitId) ctx.addIssue({ code: "custom", path: ["plannedVisitId"], message: "An unplanned visit cannot link to a plan item." });
  if (item.status === "Visited" && !item.outcome.trim()) ctx.addIssue({ code: "custom", path: ["outcome"], message: "Add a visit outcome." });
  if (item.status === "Visited" && !item.visitedPersonName?.trim()) ctx.addIssue({ code: "custom", path: ["visitedPersonName"], message: "Enter the name of the person you visited." });
  if (item.status === "Missed" && !item.reason) ctx.addIssue({ code: "custom", path: ["reason"], message: "Choose a reason for the missed visit." });
  if (item.status === "Rescheduled" && (!item.newDate || item.reason !== "Rescheduled")) ctx.addIssue({ code: "custom", path: ["newDate"], message: "Choose a new date for the rescheduled visit." });
  if (item.followUpDate && !["Call", "Email", "Visit"].includes(item.followUpPurpose ?? "")) ctx.addIssue({ code: "custom", path: ["followUpPurpose"], message: "Choose Call, Email, or Visit for the follow-up." });
  if (item.followUpPurpose === "Visit" && !item.followUpDate) ctx.addIssue({ code: "custom", path: ["followUpDate"], message: "Choose a date for the follow-up visit." });
  if (item.followUpPurpose === "Visit" && !item.followUpTime) ctx.addIssue({ code: "custom", path: ["followUpTime"], message: "Choose a time for the follow-up visit." });
  if (item.followUpDate) {
    const parsedDate = new Date(`${item.followUpDate}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== item.followUpDate) ctx.addIssue({ code: "custom", path: ["followUpDate"], message: "Enter a valid follow-up date." });
  }
});

export const monthlyPlanSheetDataSchema = z.object({
  month: monthSchema,
  generatedAtIst: z.string(),
  employee: z.object({ empCode: empCodeSchema, name: z.string(), designation: z.string(), department: z.string() }),
  plan: z.object({ version: z.number().int().nonnegative(), submittedAt: z.string().nullable(), status: z.enum(["Draft", "Submitted"]) }).nullable(),
  days: z.array(z.object({
    date: dateOnly,
    dayName: z.string(),
    isSunday: z.boolean(),
    isHoliday: z.boolean(),
    holidayName: z.string().optional(),
    rows: z.array(z.object({ customer: z.string(), location: z.string(), purpose: z.string(), remarks: z.string(), ticket: z.boolean().optional(), visited: z.boolean().optional() })),
  })),
  totals: z.object({ plannedVisits: z.number().int().nonnegative(), distinctCustomers: z.number().int().nonnegative(), workingDaysWithPlan: z.number().int().nonnegative(), sundaysAndHolidays: z.number().int().nonnegative(), tickets: z.number().int().nonnegative() }),
});
export type EmpCode = z.infer<typeof empCodeSchema>;
export type EmployeeInput = z.infer<typeof employeeInputSchema>;
export type MonthlyPlanItemInput = z.infer<typeof monthlyPlanItemInputSchema>;
/** Select the same current submitted version that the pre-versioned monthly-plan table represented. */
export function currentMonthlyPlanItems<T extends { version: number }>(items: T[], version: number): T[] {
  return items.filter(item => item.version === version);
}
export type MonthlyPlanSubmitInput = z.infer<typeof monthlyPlanSubmitSchema>;
export type MonthlyPlanSheetData = z.infer<typeof monthlyPlanSheetDataSchema>;
export type FollowUpInput = z.infer<typeof followUpInputSchema>;

export const monthlyPlanUploadValidationSchema = z.object({
  month: monthSchema,
  rows: z.array(z.object({ rowNumber: z.number().int().positive(), fields: z.record(z.string(), z.unknown()) })),
  templateType: z.enum(["standard", "change"]).optional(),
  downloadedOn: dateOnly.optional(),
  basePlanVersion: z.number().int().nonnegative().optional(),
});
export type MonthlyPlanUploadValidationInput = z.infer<typeof monthlyPlanUploadValidationSchema>;
