import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { dailyVisitActionSchema, empCodeSchema, employeeInputSchema, employeeSetActiveSchema, employeeUpdateSchema, followUpInputSchema, followUpListSchema, holidayInputSchema, indiaDateString, monthSchema, monthlyPlanItemInputSchema, monthlyPlanSheetQuerySchema, monthlyPlanSubmitSchema, monthlyPlanUploadValidationSchema, nextMondayDate, planInputSchema, planListFilterSchema, planUpdateSchema, visitInputSchema, visitListFilterSchema, visitUpdateSchema } from "../../shared/fieldOps";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { countVisitsThrough, createPlan, createVisit, deletePlan, deleteVisit, getEmployeeNames, getPlan, getRecentVisits, getVisit, listPlans, listVisits, listVisitsThroughPage, updatePlan, updateVisit } from "../fieldOpsDb";
import { cancelFollowUp, createEmployee, createFollowUp, createPlanHoliday, deletePlanHoliday, followUpDueSummary, getEmployeeForVisit, getFollowUp, getMonthlyPlanChangeState, listCompletedDailyVisits, listDailyVisitStatuses, listDailyVisitWorkload, listEmployeeDailyItems, saveDailyVisitAction, listEmployeeMaster, listFollowUps, listMonthlyPlanReport, listExecutiveMonthlyTravel, listPlanHolidays, markFollowUpDone, rescheduleFollowUp, setEmployeeActive, submitMonthlyPlan, updateEmployee } from "../fieldOpsV3Db";
import { checkLockedMonthlyPlanDays, MonthlyPlanChangeRejected } from "../monthlyPlanChange";
import { loadMonthlyPlanSheetData } from "../exports/monthlyPlanSheet/buildData";

const dateRangeSchema = z.object({ from: z.string().optional(), to: z.string().optional(), employeeName: z.string().optional() });
const sameName = (a: string) => a.trim().toLocaleLowerCase();
const within = (value: string, from?: string, to?: string) => (!from || value >= from) && (!to || value <= to);

function requireRow<T>(row: T | null, label: string): T {
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: `${label} was not found.` });
  return row;
}

export const fieldOpsRouter = router({
  employeeNames: adminProcedure.query(async () => getEmployeeNames()),
  employees: router({
    list: protectedProcedure.input(z.object({ includeInactive: z.boolean().optional() }).optional()).query(async ({ ctx, input }) => {
      const rows = ctx.user.role === "admin" ? await listEmployeeMaster(input?.includeInactive ?? true) : await listEmployeeMaster(false);
      return rows.filter(row => ctx.user.role === "admin" || row.empCode === ctx.user.empCode);
    }),
    create: adminProcedure.input(employeeInputSchema).mutation(async ({ input }) => {
      try { return await createEmployee(input); } catch (error) { throw new TRPCError({ code: "CONFLICT", message: "That Emp Code already exists.", cause: error }); }
    }),
    update: adminProcedure.input(employeeUpdateSchema).mutation(async ({ input }) => {
      const { id, ...fields } = input;
      try { return requireRow(await updateEmployee(id, fields), "Employee"); } catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "CONFLICT", message: "That Emp Code already exists.", cause: error }); }
    }),
    setActive: adminProcedure.input(employeeSetActiveSchema).mutation(async ({ ctx, input }) => {
      if (!input.isActive && input.empCode.toUpperCase() === ctx.user?.empCode) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot deactivate your own account." });
      return requireRow(await setEmployeeActive(input.empCode, input.isActive), "Employee");
    }),
  }),
  visits: router({
    list: adminProcedure.input(visitListFilterSchema.optional()).query(({ input }) => listVisits(input ?? {})),
    get: adminProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => requireRow(await getVisit(input.id), "Visit")),
    recent: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional()).query(({ ctx, input }) => getRecentVisits(input?.limit ?? 100, ctx.user.role === "admin" ? undefined : ctx.user.empCode)),
    create: protectedProcedure.input(visitInputSchema).mutation(async ({ ctx, input }) => requireRow(await createVisit({ ...input, empCode: ctx.user.role === "admin" ? input.empCode : ctx.user.empCode }), "Visit")),
    update: adminProcedure.input(visitUpdateSchema).mutation(async ({ input }) => {
      const { id, ...fields } = input;
      return requireRow(await updateVisit(id, fields), "Visit");
    }),
    delete: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteVisit(input.id)),
  }),
  plans: router({
    list: protectedProcedure.input(planListFilterSchema.optional()).query(({ ctx, input }) => listPlans({ ...(input ?? {}), ...(ctx.user.role === "admin" ? {} : { empCode: ctx.user.empCode }) })),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const plan = requireRow(await getPlan(input.id), "Plan");
      if (ctx.user.role !== "admin" && plan.empCode !== ctx.user.empCode) throw new TRPCError({ code: "NOT_FOUND", message: "Plan was not found." });
      return plan;
    }),
    create: protectedProcedure.input(planInputSchema).mutation(async ({ ctx, input }) => requireRow(await createPlan({ ...input, empCode: ctx.user.role === "admin" ? input.empCode : ctx.user.empCode }), "Plan")),
    update: protectedProcedure.input(planUpdateSchema).mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const existing = requireRow(await getPlan(id), "Plan");
      if (ctx.user.role !== "admin" && existing.empCode !== ctx.user.empCode) throw new TRPCError({ code: "NOT_FOUND", message: "Plan was not found." });
      return requireRow(await updatePlan(id, { ...fields, empCode: ctx.user.role === "admin" ? fields.empCode : ctx.user.empCode }), "Plan");
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const existing = requireRow(await getPlan(input.id), "Plan");
      if (ctx.user.role !== "admin" && existing.empCode !== ctx.user.empCode) throw new TRPCError({ code: "NOT_FOUND", message: "Plan was not found." });
      return deletePlan(input.id);
    }),
  }),
  reports: router({
    executiveTravelSummary: adminProcedure.input(z.object({ month: monthSchema })).query(({ input }) => listExecutiveMonthlyTravel(input.month)),
    executiveCompletedVisits: adminProcedure.input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).query(({ input }) => listCompletedDailyVisits(input.date)),
    overview: adminProcedure.query(async () => {
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
    allVisitsToDate: adminProcedure.input(z.object({ page: z.number().int().positive().default(1), pageSize: z.number().int().min(1).max(100).default(25) }).optional()).query(async ({ input }) => {
      const to = indiaDateString();
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 25;
      const [rows, totalVisits] = await Promise.all([listVisitsThroughPage(to, page, pageSize), countVisitsThrough(to)]);
      return { to, page, pageSize, rows, totalVisits, totalPages: Math.max(1, Math.ceil(totalVisits / pageSize)) };
    }),
    employee: adminProcedure.input(dateRangeSchema.extend({ employeeName: z.string().min(1) })).query(async ({ input }) => {
      const rows = await listVisits(input);
      return { visits: rows, totalVisits: rows.length, totalCost: rows.reduce((sum, row) => sum + Number(row.travelCost), 0), customers: new Set(rows.map(row => row.customerName.trim().toLocaleLowerCase())).size };
    }),
    costSummary: adminProcedure.input(dateRangeSchema.optional()).query(async ({ input }) => {
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
    planVsActual: adminProcedure.input(dateRangeSchema.optional()).query(async ({ input }) => {
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
    upcomingPlans: adminProcedure.input(dateRangeSchema.optional()).query(async ({ input }) => {
      const from = input?.from ?? nextMondayDate();
      const end = new Date(`${from}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 6);
      const to = input?.to ?? end.toISOString().slice(0, 10);
      return listPlans({ from, to, employeeName: input?.employeeName });
    }),
    monthlyPlan: protectedProcedure.input(z.object({ month: monthSchema, empCode: empCodeSchema.optional() })).query(({ ctx, input }) => listMonthlyPlanReport(input.month, ctx.user.role === "admin" ? input.empCode : ctx.user.empCode)),
    monthlyPlanSheet: adminProcedure.input(monthlyPlanSheetQuerySchema).query(({ input }) => loadMonthlyPlanSheetData(input.month, input.empCode, { visited: input.visited === "1", blank: input.type === "blank" })),
  }),
  monthlyPlans: router({
    changeInfo: protectedProcedure.input(z.object({ month: monthSchema })).query(({ ctx, input }) => getMonthlyPlanChangeState(ctx.user.empCode, input.month)),
    template: adminProcedure.input(z.object({ month: monthSchema, empCode: z.union([empCodeSchema, z.literal("ALL")]) })).query(async ({ input }) => {
      const roster = await listEmployeeMaster(false);
      const selected = input.empCode === "ALL" ? roster : roster.filter(employee => employee.empCode === input.empCode);
      return { month: input.month, employees: selected.map(employee => ({ empCode: employee.empCode, employeeName: employee.employeeName })), rowsPerEmployee: 50, purposes: ["New Lead", "Follow-up", "Service", "Collection", "Other"], travelModes: ["Own Vehicle", "Train", "Flight", "Cab", "Other"] };
    }),
    validateUpload: protectedProcedure.input(monthlyPlanUploadValidationSchema).mutation(async ({ ctx, input }) => {
      const roster = (await listEmployeeMaster(false)).filter(employee => ctx.user.role === "admin" || employee.empCode === ctx.user.empCode);
      const knownCodes = new Set(roster.map(employee => employee.empCode));
      const changeState = ctx.user.role === "employee" ? await getMonthlyPlanChangeState(ctx.user.empCode, input.month) : null;
      const [year, month] = input.month.split("-").map(Number);
      const monthStart = `${input.month}-01`;
      const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      const holidays = new Set((await listPlanHolidays(monthStart, monthEnd)).map(holiday => holiday.holidayDate));
      const requiredDates: string[] = [];
      for (let day = 1; day <= new Date(Date.UTC(year, month, 0)).getUTCDate(); day++) {
        const date = `${input.month}-${String(day).padStart(2, "0")}`;
        const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
        if (weekday !== 0 && !holidays.has(date)) requiredDates.push(date);
      }
      const today = indiaDateString();
      const coverageDates = changeState?.planVersion ? requiredDates.filter(date => date >= today || changeState.savedItems.some(item => item.plannedDate === date)) : requiredDates;
      const errors: Array<{ rowNumber: number; field: string; message: string }> = [];
      const validRows: Array<{ rowNumber: number; empCode: string; item: z.infer<typeof monthlyPlanItemInputSchema> }> = [];
      const coveredDates = new Map<string, Set<string>>();
      for (const row of input.rows) {
        const fields = row.fields;
        const codeResult = empCodeSchema.safeParse(fields.empCode);
        if (!codeResult.success || !knownCodes.has(codeResult.data)) { errors.push({ rowNumber: row.rowNumber, field: "empCode", message: "Emp Code is missing, unknown, or inactive." }); continue; }
        const master = roster.find(employee => employee.empCode === codeResult.data)!;
        if (String(fields.employeeName ?? "").trim() !== master.employeeName) { errors.push({ rowNumber: row.rowNumber, field: "employeeName", message: "Employee Name does not match the selected Emp Code." }); continue; }
        if (String(fields.planMonth ?? "").trim() !== input.month) { errors.push({ rowNumber: row.rowNumber, field: "planMonth", message: `Plan Month must match ${input.month}.` }); continue; }
        if (fields.coverageOnly === true) continue;
        const plannedDate = String(fields.plannedDate ?? "").trim();
        const statusEntry = String(fields.customerName ?? "").trim().toLocaleLowerCase();
        const isStatusEntry = ["no visit", "office", "leave"].includes(statusEntry);
        if (isStatusEntry) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedDate) || !plannedDate.startsWith(`${input.month}-`)) {
            errors.push({ rowNumber: row.rowNumber, field: "plannedDate", message: `Enter a valid date within ${input.month} for ${statusEntry}.` }); continue;
          }
          if (!requiredDates.includes(plannedDate)) {
            errors.push({ rowNumber: row.rowNumber, field: "plannedDate", message: `${statusEntry} can only be entered for a working day, not a Sunday or configured holiday.` }); continue;
          }
          const covered = coveredDates.get(codeResult.data) ?? new Set<string>();
          covered.add(plannedDate); coveredDates.set(codeResult.data, covered);
          const entryLabel = statusEntry === "no visit" ? "No Visit" : statusEntry === "office" ? "Office" : "Leave";
          validRows.push({ rowNumber: row.rowNumber, empCode: codeResult.data, item: { plannedDate, customerName: entryLabel, location: "—", purpose: "Other", applyForTicket: false, travelMode: null, routeFrom: null, routeTo: null, preferredDate: null, remarks: entryLabel } });
          continue;
        }
        const yes = fields.applyForTicket === true || String(fields.applyForTicket ?? "").trim().toLocaleLowerCase() === "yes";
        const item = monthlyPlanItemInputSchema.safeParse({ plannedDate: fields.plannedDate, customerName: fields.customerName, location: fields.location, purpose: fields.purpose, applyForTicket: yes, travelMode: fields.travelMode || null, routeFrom: fields.routeFrom || null, routeTo: fields.routeTo || null, preferredDate: fields.preferredDate || null, remarks: fields.remarks ?? "" });
        if (!item.success) { item.error.issues.forEach(issue => errors.push({ rowNumber: row.rowNumber, field: issue.path.join("."), message: issue.message })); continue; }
        if (!item.data.plannedDate.startsWith(`${input.month}-`)) { errors.push({ rowNumber: row.rowNumber, field: "plannedDate", message: `Date must be within ${input.month}.` }); continue; }
        if (!requiredDates.includes(item.data.plannedDate)) { errors.push({ rowNumber: row.rowNumber, field: "plannedDate", message: "Plans can only be entered for working days, not Sundays or configured holidays." }); continue; }
        const covered = coveredDates.get(codeResult.data) ?? new Set<string>();
        covered.add(item.data.plannedDate); coveredDates.set(codeResult.data, covered);
        validRows.push({ rowNumber: row.rowNumber, empCode: codeResult.data, item: item.data });
      }
      const employeesInUpload = new Set(validRows.map(row => row.empCode));
      for (const row of input.rows) {
        const code = String(row.fields.empCode ?? "").trim().toUpperCase();
        if (knownCodes.has(code)) employeesInUpload.add(code);
      }
      for (const empCode of employeesInUpload) {
        const missingDates = coverageDates.filter(date => !coveredDates.get(empCode)?.has(date));
        if (missingDates.length) errors.push({ rowNumber: 0, field: "coverage", message: `Please upload plans for all working days of the selected month. Missing dates: ${missingDates.join(", ")}.` });
      }
      const seen = new Map<string, number[]>();
      for (const row of validRows) { const key = `${row.empCode}\u0000${row.item.plannedDate}\u0000${row.item.customerName.trim().toLocaleLowerCase()}`; seen.set(key, [...(seen.get(key) ?? []), row.rowNumber]); }
      const warnings = [...seen.values()].filter(rowNumbers => rowNumbers.length > 1).flatMap(rowNumbers => rowNumbers.slice(1).map(rowNumber => ({ rowNumber, message: `Duplicate Emp Code / planned date / customer combination also appears on row ${rowNumbers[0]}.` })));
      const lockedErrors = changeState ? checkLockedMonthlyPlanDays({ month: input.month, today, candidates: validRows.map(row => ({ rowNumber: row.rowNumber, item: row.item })), savedItems: changeState.savedItems, answeredDates: changeState.answeredDates, currentPlanVersion: changeState.planVersion, basePlanVersion: input.basePlanVersion, templateType: input.templateType, enforce: ctx.user.role === "employee" }) : [];
      errors.push(...lockedErrors);
      return { validRows, errors, lockedErrors: lockedErrors.filter(error => error.field === "Past days"), warnings, totalRows: input.rows.length, validCount: validRows.length };
    }),
    submit: protectedProcedure.input(monthlyPlanSubmitSchema).mutation(async ({ ctx, input }) => {
      try { return await submitMonthlyPlan({ ...input, empCode: ctx.user.role === "admin" ? input.empCode : ctx.user.empCode }, { enforceChange: ctx.user.role === "employee" }); }
      catch (error) { if (error instanceof MonthlyPlanChangeRejected) throw new TRPCError({ code: "BAD_REQUEST", message: error.message }); throw error; }
    }),
    list: protectedProcedure.input(z.object({ month: monthSchema, empCode: empCodeSchema.optional() })).query(({ ctx, input }) => listMonthlyPlanReport(input.month, ctx.user.role === "admin" ? input.empCode : ctx.user.empCode)),
  }),
  followUps: router({
    create: protectedProcedure.input(followUpInputSchema).mutation(async ({ ctx, input }) => {
      const owner = ctx.user.role === "admin" ? input.empCode : ctx.user.empCode;
      const visit = await getEmployeeForVisit(input.visitId);
      if (!visit || (ctx.user.role !== "admin" && visit.visit.empCode !== ctx.user.empCode)) throw new TRPCError({ code: "FORBIDDEN", message: "You can only add a follow-up to your own visit." });
      if (input.followUpDate < indiaDateString()) throw new TRPCError({ code: "BAD_REQUEST", message: "Follow-up date must be today or later." });
      if (input.followUpPurpose.trim().toLocaleLowerCase() === "visit" && input.followUpDate === indiaDateString()) {
        const now = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
        if (!input.followUpTime || input.followUpTime <= now) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a visit time later than now." });
      }
      return createFollowUp({ ...input, empCode: owner });
    }),
    list: protectedProcedure.input(followUpListSchema.optional()).query(({ ctx, input }) => listFollowUps({ ...(input ?? {}), empCode: ctx.user.role === "admin" ? input?.empCode : ctx.user.empCode })),
    markDone: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const row = await getFollowUp(input.id); if (!row) return requireRow(null, "Follow-up"); if (ctx.user.role !== "admin" && row.empCode !== ctx.user.empCode) throw new TRPCError({ code: "FORBIDDEN", message: "You can only change your own follow-ups." }); return requireRow(await markFollowUpDone(input.id), "Follow-up"); }),
    reschedule: protectedProcedure.input(z.object({ id: z.number().int().positive(), followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), followUpTime: z.string().optional().nullable() })).mutation(async ({ ctx, input }) => {
      const row = await getFollowUp(input.id); if (!row) return requireRow(null, "Follow-up"); if (ctx.user.role !== "admin" && row.empCode !== ctx.user.empCode) throw new TRPCError({ code: "FORBIDDEN", message: "You can only change your own follow-ups." });
      if (input.followUpDate < indiaDateString()) throw new TRPCError({ code: "BAD_REQUEST", message: "Follow-up date must be today or later." });
      return requireRow(await rescheduleFollowUp(input.id, input.followUpDate, input.followUpTime), "Follow-up");
    }),
    cancel: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const row = await getFollowUp(input.id); if (!row) return requireRow(null, "Follow-up"); if (ctx.user.role !== "admin" && row.empCode !== ctx.user.empCode) throw new TRPCError({ code: "FORBIDDEN", message: "You can only change your own follow-ups." }); return cancelFollowUp(input.id); }),
    dueSummary: protectedProcedure.input(z.object({ empCode: empCodeSchema.optional() }).optional()).query(({ ctx, input }) => followUpDueSummary(ctx.user.role === "admin" ? input?.empCode : ctx.user.empCode, indiaDateString())),
  }),
  dailyVisit: router({
    today: protectedProcedure.input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional()).query(({ ctx, input }) => listEmployeeDailyItems(ctx.user.empCode, input?.date ?? indiaDateString())),
    statusList: protectedProcedure.input(z.object({ from: z.string().optional(), to: z.string().optional(), empCode: empCodeSchema.optional() }).optional()).query(({ ctx, input }) => listDailyVisitStatuses({ ...(input ?? {}), empCode: ctx.user.role === "admin" ? input?.empCode : ctx.user.empCode })),
    workload: protectedProcedure.input(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).query(({ ctx, input }) => listDailyVisitWorkload({ ...input, empCode: ctx.user.role === "admin" ? undefined : ctx.user.empCode })),
    save: protectedProcedure.input(dailyVisitActionSchema).mutation(async ({ ctx, input }) => {
      const today = indiaDateString(); const oldest = new Date(`${today}T00:00:00Z`); oldest.setUTCDate(oldest.getUTCDate() - 2); const oldestAllowed = oldest.toISOString().slice(0, 10);
      if (input.visitDate > today || input.visitDate < oldestAllowed) throw new TRPCError({ code: "BAD_REQUEST", message: "Daily entries can be completed for today or the previous two days." });
      if (input.lateEntry !== (input.visitDate < today)) throw new TRPCError({ code: "BAD_REQUEST", message: "Late-entry status must match the visit date." });
      if (input.status === "Rescheduled") {
        if (!input.newDate || input.newDate <= input.visitDate) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a future working day for the moved visit." });
        const weekday = new Date(`${input.newDate}T00:00:00Z`).getUTCDay();
        const holidays = await listPlanHolidays(input.newDate, input.newDate);
        if (weekday === 0 || holidays.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a working day that is not Sunday or a configured holiday." });
      }
      if (input.followUpDate && input.followUpDate < today) throw new TRPCError({ code: "BAD_REQUEST", message: "Follow-up date must be today or later." });
      if (input.followUpPurpose === "Visit" && input.followUpDate === today) {
        const now = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
        if (!input.followUpTime || input.followUpTime <= now) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a follow-up visit time later than now." });
      }
      if (input.completeFollowUpId) { const open = await getFollowUp(input.completeFollowUpId); if (!open || (ctx.user.role !== "admin" && open.empCode !== ctx.user.empCode)) throw new TRPCError({ code: "FORBIDDEN", message: "You can only update your own follow-ups." }); }
      return saveDailyVisitAction({ ...input, empCode: ctx.user.empCode, employeeName: ctx.user.employeeName });
    }),
  }),
  holidays: router({
    list: protectedProcedure.input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional()).query(({ input }) => listPlanHolidays(input?.from, input?.to)),
    create: adminProcedure.input(holidayInputSchema).mutation(async ({ input }) => { try { return await createPlanHoliday(input); } catch (error) { throw new TRPCError({ code: "CONFLICT", message: "A holiday is already configured for that date.", cause: error }); } }),
    delete: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deletePlanHoliday(input.id)),
  }),
});
