import { z } from "zod";

export type EmailScheduledVisit = {
  customerName: string;
  visitDate: string;
  location: string;
  purpose: string;
  travelMode: string;
  routeDetails: string;
  remarks: string;
  status: string;
};

export type EmailRescheduledVisit = EmailScheduledVisit & {
  originalVisitDate: string;
  newVisitDate: string;
  reason: string;
};

export type EmailFollowUp = {
  customerName: string;
  followUpDate: string;
  purpose: string;
  location: string;
  previousVisitReference: string;
  status: string;
  remarks: string;
};

export type DailyEmployeeSchedule = {
  scheduledVisits: EmailScheduledVisit[];
  rescheduledVisits: EmailRescheduledVisit[];
  todaysFollowUps: EmailFollowUp[];
  overdueFollowUps: EmailFollowUp[];
};

export type DailyEmailEmployee = { id: number; empCode: string; employeeName: string; officialWorkEmail: string | null };

export const emailAddressSchema = z.string().trim().email().max(320);

export function indiaDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatIndiaDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, day, 6)));
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function detail(label: string, value: string) {
  return value ? `<div style="margin-top:5px;color:#535d68;font-size:13px;line-height:1.55"><strong style="color:#263238">${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>` : "";
}

function emptyState() {
  return `<p style="margin:0;padding:16px;border:1px dashed #d9dee5;border-radius:10px;color:#65717e;background:#fafbfc;font-size:13px">No activities scheduled.</p>`;
}

function scheduledVisitCard(visit: EmailScheduledVisit, rescheduled = false) {
  return `<article style="margin:0 0 10px;padding:14px;border:1px solid #e3e7eb;border-radius:11px;background:#fff">
    <div style="font-size:15px;font-weight:700;color:#202a34">${escapeHtml(visit.customerName)}</div>
    ${detail("Visit date", visit.visitDate)}
    ${rescheduled ? detail("Original visit date", (visit as EmailRescheduledVisit).originalVisitDate) : ""}
    ${detail("Location", visit.location)}
    ${detail("Purpose", visit.purpose)}
    ${detail("Travel mode", visit.travelMode)}
    ${detail("Route", visit.routeDetails)}
    ${detail("Remarks", visit.remarks)}
    ${rescheduled ? detail("Reason for rescheduling", (visit as EmailRescheduledVisit).reason) : ""}
    <div style="margin-top:8px"><span style="display:inline-block;padding:4px 8px;border-radius:999px;background:${rescheduled ? "#fff1e6" : "#eef3fa"};color:${rescheduled ? "#a84d13" : "#385b84"};font-size:11px;font-weight:700">${rescheduled ? "RESCHEDULED VISIT" : escapeHtml(visit.status)}</span></div>
  </article>`;
}

function followUpCard(item: EmailFollowUp) {
  return `<article style="margin:0 0 10px;padding:14px;border:1px solid #e3e7eb;border-radius:11px;background:#fff">
    <div style="font-size:15px;font-weight:700;color:#202a34">${escapeHtml(item.customerName)}</div>
    ${detail("Follow-up date", item.followUpDate)}
    ${detail("Purpose", item.purpose)}
    ${detail("Location", item.location)}
    ${detail("Previous visit", item.previousVisitReference)}
    ${detail("Status", item.status)}
    ${detail("Remarks", item.remarks)}
  </article>`;
}

function section(title: string, count: number, body: string) {
  return `<section style="margin:20px 0 0">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;padding-bottom:9px;border-bottom:1px solid #e8ebef">
      <h2 style="margin:0;color:#202a34;font-size:16px;line-height:1.35">${title}</h2>
      <span style="color:#747f8b;font-size:12px;white-space:nowrap">${count} ${count === 1 ? "activity" : "activities"}</span>
    </div>${body || emptyState()}
  </section>`;
}

export function buildDailyEmail(input: {
  employee: Pick<DailyEmailEmployee, "employeeName">;
  date: string;
  schedule: DailyEmployeeSchedule;
  dashboardUrl: string;
}) {
  const { employee, date, schedule } = input;
  const dateLabel = formatIndiaDate(date);
  const followUpCount = schedule.todaysFollowUps.length + schedule.overdueFollowUps.length;
  const subject = `FieldDesk | Your Daily Visit & Follow-up Schedule | ${dateLabel}`;
  const followUpsHtml = [
    schedule.todaysFollowUps.length ? `<h3 style="margin:4px 0 9px;color:#41566e;font-size:13px">Today’s Follow-ups</h3>${schedule.todaysFollowUps.map(item => followUpCard(item)).join("")}` : "",
    schedule.overdueFollowUps.length ? `<h3 style="margin:14px 0 9px;color:#a33b36;font-size:13px">Overdue Pending Follow-ups</h3>${schedule.overdueFollowUps.map(item => followUpCard(item)).join("")}` : "",
  ].join("");
  const safeDashboardUrl = escapeHtml(input.dashboardUrl);
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
  <body style="margin:0;padding:0;background:#f3f5f7;font-family:Arial,Helvetica,sans-serif;color:#263238">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">Your FieldDesk schedule and follow-ups for ${escapeHtml(dateLabel)}.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f7;padding:22px 10px"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;border:1px solid #e3e7eb;border-radius:16px;background:#fff;overflow:hidden">
        <tr><td style="padding:22px 26px;background:#202a34;color:#fff;border-top:4px solid #c8102e">
          <div style="font-size:12px;letter-spacing:2px;font-weight:700;color:#ffb8be">IIMS</div><div style="margin-top:4px;font-size:22px;font-weight:700">FieldDesk</div>
          <div style="margin-top:5px;color:#cbd2da;font-size:12px">Daily field activity briefing</div>
        </td></tr>
        <tr><td style="padding:24px 26px 28px">
          <p style="margin:0 0 10px;font-size:15px">Dear ${escapeHtml(employee.employeeName)},</p>
          <p style="margin:0 0 8px;font-size:14px;line-height:1.6">Good morning!</p>
          <p style="margin:0;color:#5b6672;font-size:14px;line-height:1.6">Here is your daily work schedule for <strong style="color:#263238">${escapeHtml(dateLabel)}</strong>.</p>
          ${section("1. TODAY’S SCHEDULED VISITS", schedule.scheduledVisits.length, schedule.scheduledVisits.map(item => scheduledVisitCard(item)).join(""))}
          ${section("2. RESCHEDULED VISITS", schedule.rescheduledVisits.length, schedule.rescheduledVisits.map(item => scheduledVisitCard(item, true)).join(""))}
          ${section("3. FOLLOW-UP ACTIVITIES", followUpCount, followUpsHtml)}
          <section style="margin:24px 0 0;padding:16px;border:1px solid #e6e9ed;border-radius:12px;background:#f8f9fb">
            <h2 style="margin:0 0 11px;color:#202a34;font-size:15px">Daily summary</h2>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td style="padding:4px 8px 4px 0;color:#5d6874;font-size:12px">Scheduled visits</td><td align="right" style="padding:4px 0;color:#202a34;font-size:13px;font-weight:700">${schedule.scheduledVisits.length}</td>
            </tr><tr><td style="padding:4px 8px 4px 0;color:#5d6874;font-size:12px">Rescheduled visits</td><td align="right" style="padding:4px 0;color:#202a34;font-size:13px;font-weight:700">${schedule.rescheduledVisits.length}</td>
            </tr><tr><td style="padding:4px 8px 4px 0;color:#5d6874;font-size:12px">Follow-ups</td><td align="right" style="padding:4px 0;color:#202a34;font-size:13px;font-weight:700">${followUpCount}</td>
            </tr><tr><td style="padding:4px 8px 4px 0;color:#a33b36;font-size:12px">Overdue follow-ups</td><td align="right" style="padding:4px 0;color:#a33b36;font-size:13px;font-weight:700">${schedule.overdueFollowUps.length}</td></tr></table>
          </section>
          <p style="margin:22px 0 14px;text-align:center"><a href="${safeDashboardUrl}" style="display:inline-block;padding:12px 20px;border-radius:9px;background:#c8102e;color:#fff;text-decoration:none;font-size:13px;font-weight:700">Open FieldDesk Dashboard</a></p>
          <p style="margin:0;color:#5b6672;font-size:12px;line-height:1.65">Please complete your scheduled activities and update the respective visit and follow-up statuses in FieldDesk.</p>
          <p style="margin:16px 0 0;color:#5b6672;font-size:12px;line-height:1.6">Regards,<br><strong style="color:#263238">IIMS – FieldDesk Team</strong></p>
        </td></tr>
      </table><div style="padding:13px 8px;color:#8a949f;font-size:10px">Automated daily notification · Asia/Kolkata</div>
    </td></tr></table>
  </body></html>`;
  return { subject, html, followUpCount };
}

export function hasRelevantActivities(schedule: DailyEmployeeSchedule): boolean {
  return schedule.scheduledVisits.length + schedule.rescheduledVisits.length + schedule.todaysFollowUps.length + schedule.overdueFollowUps.length > 0;
}

export function normalizeEmployeeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const parsed = emailAddressSchema.safeParse(email);
  return parsed.success ? parsed.data.toLowerCase() : null;
}
