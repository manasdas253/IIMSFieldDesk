import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { empCodeSchema, employeeInputSchema, employeeSetActiveSchema, employeeUpdateSchema, followUpInputSchema, followUpListSchema, holidayInputSchema, indiaDateString, monthSchema, monthlyPlanItemInputSchema, monthlyPlanSheetQuerySchema, monthlyPlanSubmitSchema, monthlyPlanUploadValidationSchema, nextMondayDate, planInputSchema, planListFilterSchema, planUpdateSchema, visitInputSchema, visitListFilterSchema, visitUpdateSchema } from "../../shared/fieldOps";
import { publicProcedure, router } from "../_core/trpc";
import { countVisitsThrough, createPlan, createVisit, deletePlan, deleteVisit, getEmployeeNames, getPlan, getRecentVisits, getVisit, listPlans, listVisits, listVisitsThroughPage, updatePlan, updateVisit } from "../fieldOpsDb";
import { cancelFollowUp, createEmployee, createFollowUp, createPlanHoliday, deletePlanHoliday, followUpDueSummary, listEmployeeMaster, listFollowUps, listMonthlyPlanReport, listPlanHolidays, markFollowUpDone, rescheduleFollowUp, setEmployeeActive, submitMonthlyPlan, updateEmployee } from "../fieldOpsV3Db";
import { loadMonthlyPlanSheetData } from "../exports/monthlyPlanSheet/buildData";

const dateRangeSchema = z.object({ from: z.string().optional(), to: z.string().optional(), employeeName: z.string().optional() });
const sameName = (a: string) => a.trim().toLocaleLowerCase();
const within = (value: string, from?: string, to?: string) => (!from || value >= from) && (!to || value <= to);

function requireRow<T>(row: T | null, label: string): T {
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: `${label} was not found.` });
  return row;
}

export const fieldOpsRouter = router({
  employeeNames: publicProcedure.query(async () => getEmployeeNames()),
  employees: router({
    list: publicProcedure.input(z.object({ includeInactive: z.boolean().optional() }).optional()).query(({ input }) => listEmployeeMaster(input?.includeInactive ?? true)),
    create: publicProcedure.input(employeeInputSchema).mutation(async ({ input }) => {
      try { return await createEmployee(input); } catch (error) { throw new TRPCError({ code: "CONFLICT", message: "That Emp Code already exists.", cause: error }); }
    }),
    update: publicProcedure.input(employeeUpdateSchema).mutation(async ({ input }) => {
      const { id, ...fields } = input;
      try { return requireRow(await updateEmployee(id, fields), "Employee"); } catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "CONFLICT", message: "That Emp Code already exists.", cause: error }); }
    }),
    setActive: publicProcedure.input(employeeSetActiveSchema).mutation(async ({ input }) => requireRow(await setEmployeeActive(input.empCode, input.isActive), "Employee")),
  }),
  visits: router({
    list: publicProcedure.input(visitListFilterSchema.optional()).query(({ input }) => listVisits(input ?? {})),
    get: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => requireRow(await getVisit(input.id), "Visit")),
    recent: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional()).query(({ input }) => getRecentVisits(input?.limit ?? 100)),
    create: publicProcedure.input(visitInputSchema).mutation(async ({ input }) => requireRow(await createVisit(input), "Visit")),
    update: publicProcedure.input(visitUpdateSchema).mutation(async ({ input }) => {
      const { id, ...fields } = input;
      return requireRow(await updateVisit(id, fields), "Visit");
    }),
    delete: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteVisit(input.id)),
  }),
  plans: router({
    list: publicProcedure.input(planListFilterSchema.optional()).query(({ input }) => listPlans(input ?? {})),
    get: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => requireRow(await getPlan(input.id), "Plan")),
    create: publicProcedure.input(planInputSchema).mutation(async ({ input }) => requireRow(await createPlan(input), "Plan")),
    update: publicProcedure.input(planUpdateSchema).mutation(async ({ input }) => {
      const { id, ...fields } = input;
      return requireRow(await updatePlan(id, fields), "Plan");
    }),
    delete: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deletePlan(input.id)),
  }),
  reports: router({
    overview: publicProcedure.query(async () => {
      const today = indiaDateString();
      const monthStart = `${today.slice(0, 7)}-01`;
      const monday = nextMondayDate();
      const [todayVisits, monthVisits, plans, totalVisitsToDate] = await Promise.all([
        listVisits({ from: today, to: today }),
        listVisits({ from: monthStart, to: today }),
        listPlans({ from: monday }),
        countVisitsThrough(today),
      ]);
      const activeEmployees = new Set(todayVisits.map(row => row.employeeName)).size;
      const monthlyCost = monthVisits.reduce((sum, row) => sum + Number(row.travelCost), 0);
      const pendingPlans = plans.length;
      const months = Array.from({ length: 6 }, (_, index) => {
        const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
        d.setUTCMonth(d.getUTCMonth() - (5 - index));
        return d.toISOString().slice(0, 7);
      });
      const trendRows = await listVisits({ from: `${months[0]}-01`, to: today });
      const trend = months.map(month => ({ month, total: Math.round(trendRows.filter(row => row.visitDate.startsWith(month)).reduce((sum, row) => sum + Number(row.travelCost), 0)) }));
      return { today, visitsToday: todayVisits.length, totalVisitsToDate, activeEmployees, monthlyCost, pendingPlans, trend };
    }),
    allVisitsToDate: publicProcedure.input(z.object({ page: z.number().int().positive().default(1), pageSize: z.number().int().min(1).max(100).default(25) }).optional()).query(async ({ input }) => {
      const to = indiaDateString();
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 25;
      const [rows, totalVisits] = await Promise.all([listVisitsThroughPage(to, page, pageSize), countVisitsThrough(to)]);
      return { to, page, pageSize, rows, totalVisits, totalPages: Math.max(1, Math.ceil(totalVisits / pageSize)) };
    }),
    employee: publicProcedure.input(dateRangeSchema.extend({ employeeName: z.string().min(1) })).query(async ({ input }) => {
      const rows = await listVisits(input);
      return { visits: rows, totalVisits: rows.length, totalCost: rows.reduce((sum, row) => sum + Number(row.travelCost), 0), customers: new Set(rows.map(row => row.customerName.trim().toLocaleLowerCase())).size };
    }),
    costSummary: publicProcedure.input(dateRangeSchema.optional()).query(async ({ input }) => {
      const today = indiaDateString();
      const from = input?.from ?? `${today.slice(0, 7)}-01`;
      const to = input?.to ?? today;
      const rows = await listVisits({ from, to, employeeName: input?.employeeName });
      const groups = new Map<string, { employeeName: string; month: string; visitCount: number; totalCost: number }>();
      for (const row of rows) {
        const key = `${row.employeeName}\u0000${row.visitDate.slice(0, 7)}`;
        const value = groups.get(key) ?? { employeeName: row.employeeName, month: row.visitDate.slice(0, 7), visitCount: 0, totalCost: 0 };
        value.visitCount += 1;
        value.totalCost += Number(row.travelCost);
        groups.set(key, value);
      }
      return [...groups.values()].map(row => ({ ...row, averageCost: row.visitCount ? row.totalCost / row.visitCount : 0 }));
    }),
    planVsActual: publicProcedure.input(dateRangeSchema.optional()).query(async ({ input }) => {
      const actualTo = input?.to ? new Date(Date.parse(`${input.to}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10) : undefined;
      const [plans, actuals] = await Promise.all([listPlans({ from: input?.from, to: input?.to, employeeName: input?.employeeName }), listVisits({ from: input?.from, to: actualTo, employeeName: input?.employeeName })]);
      const results: Array<{ id: string; employeeName: string; weekStartingDate: string; plannedCustomerName: string; actualCustomerName: string; plannedLocation: string; actualLocation: string; purpose: string; status: "Visited" | "No-show" | "Unplanned"; actualDate: string; actualOutcome: string }> = [];
      for (const plan of plans) {
        const weekEnd = new Date(`${plan.weekStartingDate}T00:00:00Z`);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
        const end = weekEnd.toISOString().slice(0, 10);
        for (const item of plan.items) {
          const match = actuals.find(actual => sameName(actual.employeeName) === sameName(plan.employeeName) && sameName(actual.customerName) === sameName(item.customerName) && actual.visitDate >= plan.weekStartingDate && actual.visitDate <= end);
          results.push({ id: `planned-${item.id}`, employeeName: plan.employeeName, weekStartingDate: plan.weekStartingDate, plannedCustomerName: item.customerName, actualCustomerName: match?.customerName ?? "", plannedLocation: item.location, actualLocation: match?.location ?? "", purpose: item.purpose, status: match ? "Visited" : "No-show", actualDate: match?.visitDate ?? "", actualOutcome: match?.outcome ?? "" });
        }
      }
      for (const actual of actuals) {
        if (!within(actual.visitDate, input?.from, input?.to)) continue;
        const match = plans.find(plan => sameName(plan.employeeName) === sameName(actual.employeeName) && actual.visitDate >= plan.weekStartingDate && actual.visitDate <= new Date(Date.parse(`${plan.weekStartingDate}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10) && plan.items.some(item => sameName(item.customerName) === sameName(actual.customerName)));
        if (!match) results.push({ id: `actual-${actual.id}`, employeeName: actual.employeeName, weekStartingDate: actual.visitDate, plannedCustomerName: "", actualCustomerName: actual.customerName, plannedLocation: "", actualLocation: actual.location, purpose: actual.purpose, status: "Unplanned", actualDate: actual.visitDate, actualOutcome: actual.outcome });
      }
      return results;
    }),
    upcomingPlans: publicProcedure.input(dateRangeSchema.optional()).query(async ({ input }) => {
      const from = input?.from ?? nextMondayDate();
      const end = new Date(`${from}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 6);
      const to = input?.to ?? end.toISOString().slice(0, 10);
      return listPlans({ from, to, employeeName: input?.employeeName });
    }),
    monthlyPlan: publicProcedure.input(z.object({ month: monthSchema, empCode: empCodeSchema.optional() })).query(({ input }) => listMonthlyPlanReport(input.month, input.empCode)),
    monthlyPlanSheet: publicProcedure.input(monthlyPlanSheetQuerySchema).query(({ input }) => loadMonthlyPlanSheetData(input.month, input.empCode, { visited: input.visited === "1", blank: input.type === "blank" })),
  }),
  monthlyPlans: router({
    template: publicProcedure.input(z.object({ month: monthSchema, empCode: z.union([empCodeSchema, z.literal("ALL")]) })).query(async ({ input }) => {
      const roster = await listEmployeeMaster(false);
      const selected = input.empCode === "ALL" ? roster : roster.filter(employee => employee.empCode === input.empCode);
      return { month: input.month, employees: selected.map(employee => ({ empCode: employee.empCode, employeeName: employee.employeeName })), rowsPerEmployee: 50, purposes: ["New Lead", "Follow-up", "Service", "Collection", "Other"], travelModes: ["Own Vehicle", "Train", "Flight", "Cab", "Other"] };
    }),
    validateUpload: publicProcedure.input(monthlyPlanUploadValidationSchema).mutation(async ({ input }) => {
      const roster = await listEmployeeMaster(false);
      const knownCodes = new Set(roster.map(employee => employee.empCode));
      const errors: Array<{ rowNumber: number; field: string; message: string }> = [];
      const validRows: Array<{ rowNumber: number; empCode: string; item: z.infer<typeof monthlyPlanItemInputSchema> }> = [];
      for (const row of input.rows) {
        const fields = row.fields;
        const codeResult = empCodeSchema.safeParse(fields.empCode);
        if (!codeResult.success || !knownCodes.has(codeResult.data)) { errors.push({ rowNumber: row.rowNumber, field: "empCode", message: "Emp Code is missing, unknown, or inactive." }); continue; }
        const master = roster.find(employee => employee.empCode === codeResult.data)!;
        if (String(fields.employeeName ?? "").trim() !== master.employeeName) { errors.push({ rowNumber: row.rowNumber, field: "employeeName", message: "Employee Name does not match the selected Emp Code." }); continue; }
        if (String(fields.planMonth ?? "").trim() !== input.month) { errors.push({ rowNumber: row.rowNumber, field: "planMonth", message: `Plan Month must match ${input.month}.` }); continue; }
        const yes = fields.applyForTicket === true || String(fields.applyForTicket ?? "").trim().toLocaleLowerCase() === "yes";
        const item = monthlyPlanItemInputSchema.safeParse({ plannedDate: fields.plannedDate, customerName: fields.customerName, location: fields.location, purpose: fields.purpose, applyForTicket: yes, travelMode: fields.travelMode || null, routeFrom: fields.routeFrom || null, routeTo: fields.routeTo || null, preferredDate: fields.preferredDate || null, remarks: fields.remarks ?? "" });
        if (!item.success) { item.error.issues.forEach(issue => errors.push({ rowNumber: row.rowNumber, field: issue.path.join("."), message: issue.message })); continue; }
        if (!item.data.plannedDate.startsWith(`${input.month}-`)) { errors.push({ rowNumber: row.rowNumber, field: "plannedDate", message: `Date must be within ${input.month}.` }); continue; }
        validRows.push({ rowNumber: row.rowNumber, empCode: codeResult.data, item: item.data });
      }
      const seen = new Map<string, number[]>();
      for (const row of validRows) { const key = `${row.empCode}\u0000${row.item.plannedDate}\u0000${row.item.customerName.trim().toLocaleLowerCase()}`; seen.set(key, [...(seen.get(key) ?? []), row.rowNumber]); }
      const warnings = [...seen.values()].filter(rowNumbers => rowNumbers.length > 1).flatMap(rowNumbers => rowNumbers.slice(1).map(rowNumber => ({ rowNumber, message: `Duplicate Emp Code / planned date / customer combination also appears on row ${rowNumbers[0]}.` })));
      return { validRows, errors, warnings, totalRows: input.rows.length, validCount: validRows.length };
    }),
    submit: publicProcedure.input(monthlyPlanSubmitSchema).mutation(({ input }) => submitMonthlyPlan(input)),
    list: publicProcedure.input(z.object({ month: monthSchema, empCode: empCodeSchema.optional() })).query(({ input }) => listMonthlyPlanReport(input.month, input.empCode)),
  }),
  followUps: router({
    create: publicProcedure.input(followUpInputSchema).mutation(async ({ input }) => {
      if (input.followUpDate < indiaDateString()) throw new TRPCError({ code: "BAD_REQUEST", message: "Follow-up date must be today or later." });
      return createFollowUp(input);
    }),
    list: publicProcedure.input(followUpListSchema.optional()).query(({ input }) => listFollowUps(input ?? {})),
    markDone: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => requireRow(await markFollowUpDone(input.id), "Follow-up")),
    reschedule: publicProcedure.input(z.object({ id: z.number().int().positive(), followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), followUpTime: z.string().optional().nullable() })).mutation(async ({ input }) => {
      if (input.followUpDate < indiaDateString()) throw new TRPCError({ code: "BAD_REQUEST", message: "Follow-up date must be today or later." });
      return requireRow(await rescheduleFollowUp(input.id, input.followUpDate, input.followUpTime), "Follow-up");
    }),
    cancel: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => cancelFollowUp(input.id)),
    dueSummary: publicProcedure.input(z.object({ empCode: empCodeSchema.optional() }).optional()).query(({ input }) => followUpDueSummary(input?.empCode, indiaDateString())),
  }),
  holidays: router({
    list: publicProcedure.input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional()).query(({ input }) => listPlanHolidays(input?.from, input?.to)),
    create: publicProcedure.input(holidayInputSchema).mutation(async ({ input }) => { try { return await createPlanHoliday(input); } catch (error) { throw new TRPCError({ code: "CONFLICT", message: "A holiday is already configured for that date.", cause: error }); } }),
    delete: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deletePlanHoliday(input.id)),
  }),
});
