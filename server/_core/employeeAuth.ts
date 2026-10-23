import { promisify } from "node:util";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { parse } from "cookie";
import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import { employees } from "../../drizzle/schema";
import { getDb } from "../db";

const scrypt = promisify(scryptCallback);
export const EMPLOYEE_SESSION_COOKIE = "fielddesk_session";
const SESSION_SECONDS = 12 * 60 * 60;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const normalizeCode = (value: string) => value.trim().toUpperCase();

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("Set AUTH_SECRET in .env (32+ characters). See .env.example.");
  return new TextEncoder().encode(value);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, saltText, keyText] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltText || !keyText) return false;
  const salt = Buffer.from(saltText, "base64url");
  const expected = Buffer.from(keyText, "base64url");
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function checkLoginRateLimit(key: string) {
  const now = Date.now();
  if (loginAttempts.size > 10_000) {
    for (const [entry, value] of loginAttempts) if (value.resetAt <= now) loginAttempts.delete(entry);
    while (loginAttempts.size > 10_000) loginAttempts.delete(loginAttempts.keys().next().value!);
  }
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
    return true;
  }
  current.count += 1;
  return current.count <= 8;
}

export function clearLoginRateLimit(key: string) { loginAttempts.delete(key); }

export function credentialVersion(passwordHash: string, role: "employee" | "admin") { return createHash("sha256").update(`${passwordHash}:${role}`).digest("base64url"); }

export async function issueSession(empCode: string, passwordHash: string, role: "employee" | "admin") {
  return new SignJWT({ cv: credentialVersion(passwordHash, role) }).setProtectedHeader({ alg: "HS256" }).setSubject(normalizeCode(empCode)).setIssuedAt().setExpirationTime(`${SESSION_SECONDS}s`).sign(secret());
}

export async function readSession(request: Request) {
  const token = parse(request.headers.cookie ?? "")[EMPLOYEE_SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" && typeof payload.cv === "string" ? { empCode: normalizeCode(payload.sub), credentialVersion: payload.cv } : null;
  } catch { return null; }
}

export function setSessionCookie(res: import("express").Response, token: string) {
  res.cookie(EMPLOYEE_SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS * 1000 });
}

export function clearSessionCookie(res: import("express").Response) {
  res.clearCookie(EMPLOYEE_SESSION_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
}

export async function findActiveEmployee(empCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [employee] = await db.select().from(employees).where(and(eq(employees.empCode, normalizeCode(empCode)), eq(employees.isActive, true))).limit(1);
  return employee ?? null;
}

export async function bootstrapAdmin() {
  const code = process.env.BOOTSTRAP_ADMIN_EMPCODE?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!code && !password) return;
  if (!code || !password) throw new Error("Set both BOOTSTRAP_ADMIN_EMPCODE and BOOTSTRAP_ADMIN_PASSWORD.");
  if (password.length < 12) throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.");
  const db = await getDb();
  if (!db) throw new Error("Database is required to bootstrap the administrator.");
  const normalized = normalizeCode(code);
  const [existing] = await db.select().from(employees).where(eq(employees.empCode, normalized)).limit(1);
  if (!existing) {
    await db.insert(employees).values({ empCode: normalized, employeeName: "Administrator", role: "admin", passwordHash: await hashPassword(password), mustChangePassword: true });
  } else if (!existing.passwordHash) {
    await db.update(employees).set({ role: "admin", passwordHash: await hashPassword(password), mustChangePassword: true, isActive: true }).where(eq(employees.empCode, normalized));
  }
}
