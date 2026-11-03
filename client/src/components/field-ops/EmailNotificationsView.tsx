import { useState } from "react";
import { Mail, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const dateInIndia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default function EmailNotificationsView() {
  const [date, setDate] = useState(dateInIndia());
  const [employeeId, setEmployeeId] = useState("");
  const [testEmployee, setTestEmployee] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const utils = trpc.useUtils();
  const employees = trpc.fieldOps.employees.list.useQuery({ includeInactive: false });
  const history = trpc.fieldOps.emailNotifications.history.useQuery({ date: date || undefined, employeeId: employeeId ? Number(employeeId) : undefined, limit: 300 });
  const refresh = () => utils.fieldOps.emailNotifications.history.invalidate();
  const sendTest = trpc.fieldOps.emailNotifications.test.useMutation({ onSuccess: async result => { toast.success(result.status === "sent" ? "Test email sent" : result.status === "failed" ? result.error : "Test email skipped"); await refresh(); }, onError: error => toast.error(error.message) });
  const resend = trpc.fieldOps.emailNotifications.resendFailed.useMutation({ onSuccess: async result => { toast.success(result.status === "sent" ? "Email resent" : result.status === "failed" ? result.error : "Resend skipped"); await refresh(); }, onError: error => toast.error(error.message) });
  return <div className="view-stack email-history-view">
    <div className="page-heading"><div><p className="eyebrow">ADMINISTRATION · NOTIFICATIONS</p><h1>Email notification history.</h1><p className="page-subtitle">Review daily employee briefings, inspect failures, and send controlled test emails.</p></div><div className="report-icon"><Mail size={20} /></div></div>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">CONTROLLED DELIVERY</p><h2>Send a test email</h2></div></div>
      <form className="filter-strip email-test-form" onSubmit={event => { event.preventDefault(); sendTest.mutate({ empCode: testEmployee, testEmail }); }}>
        <label className="filter-select"><span>Schedule context</span><select required value={testEmployee} onChange={event => setTestEmployee(event.target.value)}><option value="">Choose employee</option>{(employees.data ?? []).map(person => <option key={person.id} value={person.empCode}>{person.empCode} · {person.employeeName}</option>)}</select></label>
        <label className="filter-select"><span>Test recipient email</span><input required type="email" value={testEmail} onChange={event => setTestEmail(event.target.value)} placeholder="you@example.com" /></label>
        <button className="button button-primary" type="submit" disabled={sendTest.isPending || !testEmployee || !testEmail}><Send size={15} />{sendTest.isPending ? "Sending…" : "Send test"}</button>
      </form>
      <p className="page-subtitle email-help">Test messages are tracked separately and do not consume the employee’s automatic daily notification.</p>
    </section>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">DELIVERY LOG</p><h2>Notification history</h2></div><button type="button" className="button button-secondary" onClick={() => history.refetch()}><RefreshCw size={15} />Refresh</button></div>
      <div className="filter-strip email-history-filters"><label><span className="filter-label">Notification date</span><input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><label><span className="filter-label">Employee</span><select value={employeeId} onChange={event => setEmployeeId(event.target.value)}><option value="">All employees</option>{(employees.data ?? []).map(person => <option key={person.id} value={person.id}>{person.empCode} · {person.employeeName}</option>)}</select></label></div>
      <div className="table-card"><div className="table-scroll"><table className="data-table"><thead><tr><th>Employee</th><th>Email</th><th>Date</th><th>Sent time</th><th>Visits</th><th>Rescheduled</th><th>Follow-ups</th><th>Status</th><th>Error / action</th></tr></thead><tbody>
        {(history.data ?? []).map(row => <tr key={row.id}><td><strong>{row.employeeName}</strong><small>{row.employeeCode}{row.attemptType !== "Automatic" ? ` · ${row.attemptType}` : ""}</small></td><td>{row.employeeEmail}</td><td>{row.notificationDate}</td><td>{row.sentAt ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(row.sentAt)) : "—"}</td><td>{row.scheduledVisitCount}</td><td>{row.rescheduledVisitCount}</td><td>{row.followUpCount}{row.overdueFollowUpCount ? ` (${row.overdueFollowUpCount} overdue)` : ""}</td><td><span className={`status-pill ${row.deliveryStatus.toLowerCase()}`}>{row.deliveryStatus}</span></td><td>{row.errorDetails ? <div className="email-error-cell"><span title={row.errorDetails}>{row.errorDetails}</span>{row.deliveryStatus === "Failed" && row.attemptType !== "Test" && <button type="button" className="button button-secondary email-resend" disabled={resend.isPending} onClick={() => resend.mutate({ id: row.id })}>Resend</button>}</div> : "—"}</td></tr>)}
        {!history.isLoading && !history.data?.length && <tr><td colSpan={9}>No notification history for these filters.</td></tr>}
      </tbody></table></div></div>
    </section>
  </div>;
}
