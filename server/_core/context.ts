import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { credentialVersion, findActiveEmployee, readSession } from "./employeeAuth";

export type SessionEmployee = { id: number; empCode: string; employeeName: string; role: "employee" | "admin"; mustChangePassword: boolean };
export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: SessionEmployee | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  const session = await readSession(opts.req);
  const employee = session ? await findActiveEmployee(session.empCode) : null;
  const validSession = employee?.passwordHash && session && credentialVersion(employee.passwordHash, employee.role) === session.credentialVersion;
  return { req: opts.req, res: opts.res, user: validSession && employee ? { id: employee.id, empCode: employee.empCode, employeeName: employee.employeeName, role: employee.role, mustChangePassword: employee.mustChangePassword } : null };
}
