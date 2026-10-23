import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { employees } from "../../drizzle/schema";
import { clearLoginRateLimit, checkLoginRateLimit, clearSessionCookie, findActiveEmployee, hashPassword, issueSession, setSessionCookie, verifyPassword } from "../_core/employeeAuth";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

const passwordSchema = z.string().min(12).max(128);
const codeSchema = z.string().trim().min(1).max(20).transform(value => value.toUpperCase());

export const authRouter = router({
  me: protectedProcedure.query(({ ctx }) => ctx.user),
  login: publicProcedure.input(z.object({ empCode: codeSchema, password: z.string().min(1).max(128) })).mutation(async ({ ctx, input }) => {
    const key = `${ctx.req.ip ?? "unknown"}:${input.empCode}`;
    if (!checkLoginRateLimit(key)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Try again in 15 minutes." });
    const employee = await findActiveEmployee(input.empCode);
    const valid = employee?.passwordHash ? await verifyPassword(input.password, employee.passwordHash) : false;
    if (!employee || !valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Emp Code or password is incorrect." });
    clearLoginRateLimit(key);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
    await db.update(employees).set({ lastLoginAt: new Date() }).where(and(eq(employees.id, employee.id), eq(employees.isActive, true)));
    setSessionCookie(ctx.res, await issueSession(employee.empCode, employee.passwordHash!, employee.role));
    return { id: employee.id, empCode: employee.empCode, employeeName: employee.employeeName, role: employee.role, mustChangePassword: employee.mustChangePassword };
  }),
  logout: publicProcedure.mutation(({ ctx }) => { clearSessionCookie(ctx.res); return { success: true }; }),
  changePassword: protectedProcedure.input(z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema })).mutation(async ({ ctx, input }) => {
    const employee = await findActiveEmployee(ctx.user.empCode);
    if (!employee?.passwordHash || !await verifyPassword(input.currentPassword, employee.passwordHash)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect." });
    if (input.currentPassword === input.newPassword) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a password you have not used before." });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
    const passwordHash = await hashPassword(input.newPassword);
    await db.update(employees).set({ passwordHash, mustChangePassword: false }).where(eq(employees.id, employee.id));
    setSessionCookie(ctx.res, await issueSession(employee.empCode, passwordHash, employee.role));
    return { success: true };
  }),
  adminSetCredentials: adminProcedure.input(z.object({ empCode: codeSchema, password: passwordSchema, role: z.enum(["employee", "admin"]).optional() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
    if (input.empCode === ctx.user?.empCode && input.role === "employee") throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot demote your own account." });
    const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.empCode, input.empCode), eq(employees.isActive, true))).limit(1);
    if (!employee) throw new TRPCError({ code: "NOT_FOUND", message: "Active employee was not found." });
    await db.update(employees).set({ passwordHash: await hashPassword(input.password), mustChangePassword: true, ...(input.role ? { role: input.role } : {}) }).where(eq(employees.id, employee.id));
    return { success: true };
  }),
});
