import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { clearLoginRateLimit, hashPassword, issueSession, readSession, verifyPassword, checkLoginRateLimit, EMPLOYEE_SESSION_COOKIE } from "./_core/employeeAuth";

describe("employee authentication primitives", () => {
  beforeEach(() => { process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters-long"; });

  it("hashes passwords and verifies only the matching password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("incorrect password", hash)).toBe(false);
  });

  it("signs a 12 hour session bound to the normalized employee code", async () => {
    const token = await issueSession(" ab-123 ", await hashPassword("test password valid"), "employee");
    const session = await readSession({ headers: { cookie: `${EMPLOYEE_SESSION_COOKIE}=${token}` } } as never);
    expect(session?.empCode).toBe("AB-123");
  });

  it("limits repeated sign-in attempts and can reset a successful login bucket", () => {
    const key = `auth-test-${Math.random()}`;
    for (let i = 0; i < 8; i++) expect(checkLoginRateLimit(key)).toBe(true);
    expect(checkLoginRateLimit(key)).toBe(false);
    clearLoginRateLimit(key);
    expect(checkLoginRateLimit(key)).toBe(true);
  });
});

describe("authorization middleware", () => {
  const caller = (user: { id: number; empCode: string; employeeName: string; role: "employee" | "admin"; mustChangePassword: boolean } | null) => appRouter.createCaller({ req: {} as never, res: {} as never, user });

  it("rejects unauthenticated protected requests", async () => {
    await expect(caller(null).auth.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects employee access to administrator procedures", async () => {
    await expect(caller({ id: 7, empCode: "EMP007", employeeName: "Field User", role: "employee", mustChangePassword: false }).fieldOps.reports.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires a forced password update before field operations", async () => {
    await expect(caller({ id: 7, empCode: "EMP007", employeeName: "Field User", role: "employee", mustChangePassword: true }).fieldOps.holidays.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
