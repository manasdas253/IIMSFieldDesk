import { and, desc, eq, lt } from "drizzle-orm";
import { Resend } from "resend";
import { dailyEmailNotifications } from "../drizzle/schema";
import { getDb } from "./db";
import { buildDailyEmail, hasRelevantActivities, indiaDateString, normalizeEmployeeEmail, type DailyEmailEmployee, type DailyEmployeeSchedule } from "./dailyEmailContent";
import { loadDailyEmployeeSchedule } from "./dailyEmailData";
import { listEmployeeMaster } from "./fieldOpsV3Db";

const dashboardUrl = () => process.env.APP_URL || "http://localhost:3000";
const counts = (schedule: DailyEmployeeSchedule) => ({
  scheduledVisitCount: schedule.scheduledVisits.length,
  rescheduledVisitCount: schedule.rescheduledVisits.length,
  followUpCount: schedule.todaysFollowUps.length + schedule.overdueFollowUps.length,
  overdueFollowUpCount: schedule.overdueFollowUps.length,
});
const safeError = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 4000);
export function getNotificationInsertId(result: unknown): number | undefined {
  const header = Array.isArray(result) ? result[0] : result;
  const id = (header as { insertId?: number } | null | undefined)?.insertId;
  return typeof id === "number" && id > 0 ? id : undefined;
}
function getAffectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  const value = header as { affectedRows?: number; rowsAffected?: number } | null | undefined;
  return value?.affectedRows ?? value?.rowsAffected ?? 0;
}
function notificationInsertError(error: unknown) {
  const code = (error as { code?: string; errno?: number }).code;
  const errno = (error as { errno?: number }).errno;
  if (code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR" || errno === 1146 || errno === 1054) {
    return new Error("The daily email history database schema is missing or out of date. Run `pnpm db:migrate` against this app's DATABASE_URL, then retry.");
  }
  if (code === "ER_NO_REFERENCED_ROW_2" || errno === 1452) {
    return new Error("The selected employee record is missing from the database. Refresh Employee Directory and try again.");
  }
  return new Error("Could not create the daily email history record. Check the database connection and migrations, then retry.");
}

function resendClient() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM?.trim();
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  if (!from) throw new Error("EMAIL_FROM is not configured");
  return { client: new Resend(key), from };
}

type NotifyInput = {
  employee: DailyEmailEmployee;
  date: string;
  schedule: DailyEmployeeSchedule;
  attemptType?: "Automatic" | "Manual" | "Test";
  testEmail?: string;
  parentId?: number;
};

async function sendTracked(input: NotifyInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const attemptType = input.attemptType ?? "Automatic";
  const recipient = attemptType === "Test" ? normalizeEmployeeEmail(input.testEmail) : normalizeEmployeeEmail(input.employee.officialWorkEmail);
  const recipientError = !recipient ? (attemptType === "Test" ? "Enter a valid test recipient email." : input.employee.officialWorkEmail ? "Employee email address is invalid." : "Employee has no official work email.") : null;
  const content = buildDailyEmail({ employee: input.employee, date: input.date, schedule: input.schedule, dashboardUrl: dashboardUrl() });
  const row: typeof dailyEmailNotifications.$inferInsert = {
    employeeId: input.employee.id, employeeCode: input.employee.empCode, employeeName: input.employee.employeeName,
    employeeEmail: recipient ?? input.employee.officialWorkEmail ?? "(missing)", notificationDate: input.date, emailSubject: content.subject, ...counts(input.schedule),
    attemptType, parentNotificationId: input.parentId ?? null, htmlSnapshot: content.html,
    idempotencyKey: attemptType === "Automatic" ? `auto/${input.employee.id}/${input.date}` : null,
    deliveryStatus: "Processing",
  };
  let id: number;
  let sendHtml = content.html;
  let sendSubject = content.subject;
  if (attemptType === "Automatic") {
    let insertedId: number | undefined;
    try {
      const inserted = await db.insert(dailyEmailNotifications).values(row);
      insertedId = getNotificationInsertId(inserted);
      if (!insertedId) throw new Error("Database did not return the notification row ID.");
    } catch (error) {
      const duplicate = (error as { code?: string; errno?: number }).code === "ER_DUP_ENTRY" || (error as { errno?: number }).errno === 1062;
      if (!duplicate) throw notificationInsertError(error);
    }
    if (!insertedId) {
      const [existing] = await db.select().from(dailyEmailNotifications).where(eq(dailyEmailNotifications.idempotencyKey, row.idempotencyKey!)).limit(1);
      if (!existing || existing.deliveryStatus === "Sent" || existing.deliveryStatus === "Resent") return { status: "skipped" as const };
      sendHtml = existing.htmlSnapshot ?? content.html;
      sendSubject = existing.emailSubject;
      const staleAfter = Date.now() - 15 * 60_000;
      const isStaleProcessing = existing.deliveryStatus === "Processing" && existing.updatedAt.getTime() < staleAfter;
      if (existing.deliveryStatus === "Processing" && !isStaleProcessing) return { status: "skipped" as const };
      if (isStaleProcessing && Date.now() - existing.updatedAt.getTime() >= 24 * 60 * 60_000) {
        await db.update(dailyEmailNotifications).set({ deliveryStatus: "Failed", errorDetails: "An automatic send stopped before recording its result. Use a manual resend after checking Resend logs." })
          .where(and(eq(dailyEmailNotifications.id, existing.id), eq(dailyEmailNotifications.deliveryStatus, "Processing"), lt(dailyEmailNotifications.updatedAt, new Date(staleAfter))));
        return { status: "skipped" as const };
      }
      const claimCondition = isStaleProcessing
        ? and(eq(dailyEmailNotifications.id, existing.id), eq(dailyEmailNotifications.deliveryStatus, "Processing"), lt(dailyEmailNotifications.updatedAt, new Date(staleAfter)))
        : and(eq(dailyEmailNotifications.id, existing.id), eq(dailyEmailNotifications.deliveryStatus, "Failed"));
      const claimed = await db.update(dailyEmailNotifications).set({ deliveryStatus: "Processing", errorDetails: null, updatedAt: new Date() })
        .where(claimCondition);
      if (!getAffectedRows(claimed)) return { status: "skipped" as const };
      id = existing.id;
    } else id = insertedId;
  } else {
    try {
      const inserted = await db.insert(dailyEmailNotifications).values(row);
      const insertId = getNotificationInsertId(inserted);
      if (!insertId) throw new Error("Database did not return the notification row ID.");
      id = insertId;
    } catch (error) {
      throw notificationInsertError(error);
    }
  }
  try {
    if (recipientError || !recipient) throw new Error(recipientError ?? "Recipient email is invalid.");
    const { client, from } = resendClient();
    const options = attemptType === "Automatic" ? { idempotencyKey: row.idempotencyKey! } : undefined;
    const { data, error } = await client.emails.send({ from, to: recipient, subject: sendSubject, html: sendHtml }, options);
    if (error) throw new Error(error.message);
    await db.update(dailyEmailNotifications).set({ deliveryStatus: "Sent", resendMessageId: data?.id ?? null, sentAt: new Date(), errorDetails: null }).where(eq(dailyEmailNotifications.id, id));
    if (attemptType === "Manual" && input.parentId) await db.update(dailyEmailNotifications).set({ deliveryStatus: "Resent", resendMessageId: data?.id ?? null, sentAt: new Date(), errorDetails: null }).where(eq(dailyEmailNotifications.id, input.parentId));
    return { status: "sent" as const, id };
  } catch (error) {
    await db.update(dailyEmailNotifications).set({ deliveryStatus: "Failed", errorDetails: safeError(error) }).where(eq(dailyEmailNotifications.id, id));
    return { status: "failed" as const, id, error: safeError(error) };
  }
}

export async function runDailyEmailNotifications(date = indiaDateString()) {
  const roster = (await listEmployeeMaster(false)).filter(employee => employee.isActive);
  const summary = { considered: roster.length, sent: 0, failed: 0, skipped: 0 };
  for (const employee of roster) {
    try {
      const schedule = await loadDailyEmployeeSchedule(employee.empCode, date);
      if (!hasRelevantActivities(schedule)) { summary.skipped++; continue; }
      const result = await sendTracked({ employee, date, schedule });
      if (result.status === "sent") summary.sent++;
      else if (result.status === "failed") summary.failed++;
      else summary.skipped++;
    } catch (error) {
      summary.failed++;
      console.error(`[DailyEmail] Failed to prepare notification for employee ${employee.empCode}:`, safeError(error));
    }
  }
  return summary;
}

export async function sendTestDailyEmail(empCode: string, testEmail: string) {
  const employee = (await listEmployeeMaster(false)).find(row => row.empCode === empCode);
  if (!employee) throw new Error("Employee was not found.");
  const date = indiaDateString();
  const schedule = await loadDailyEmployeeSchedule(empCode, date);
  return sendTracked({ employee, date, schedule, attemptType: "Test", testEmail });
}

export async function resendFailedDailyEmail(id: number) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const [source] = await db.select().from(dailyEmailNotifications).where(eq(dailyEmailNotifications.id, id)).limit(1);
  if (!source || source.deliveryStatus !== "Failed") throw new Error("Only failed notifications can be resent.");
  const employee: DailyEmailEmployee = { id: source.employeeId, empCode: source.employeeCode, employeeName: source.employeeName, officialWorkEmail: source.employeeEmail };
  const schedule = await loadDailyEmployeeSchedule(employee.empCode, source.notificationDate);
  return sendTracked({ employee, date: source.notificationDate, schedule, attemptType: "Manual", parentId: id });
}

export async function listDailyEmailHistory(input: { date?: string; employeeId?: number; limit?: number }) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const conditions = [];
  if (input.date) conditions.push(eq(dailyEmailNotifications.notificationDate, input.date));
  if (input.employeeId) conditions.push(eq(dailyEmailNotifications.employeeId, input.employeeId));
  return db.select({ id: dailyEmailNotifications.id, employeeName: dailyEmailNotifications.employeeName,
    employeeCode: dailyEmailNotifications.employeeCode, employeeEmail: dailyEmailNotifications.employeeEmail,
    notificationDate: dailyEmailNotifications.notificationDate, sentAt: dailyEmailNotifications.sentAt,
    scheduledVisitCount: dailyEmailNotifications.scheduledVisitCount, rescheduledVisitCount: dailyEmailNotifications.rescheduledVisitCount,
    followUpCount: dailyEmailNotifications.followUpCount, overdueFollowUpCount: dailyEmailNotifications.overdueFollowUpCount,
    deliveryStatus: dailyEmailNotifications.deliveryStatus, attemptType: dailyEmailNotifications.attemptType,
    errorDetails: dailyEmailNotifications.errorDetails,
  }).from(dailyEmailNotifications).where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(dailyEmailNotifications.createdAt)).limit(input.limit ?? 200);
}
