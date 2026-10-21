import { useEffect, useState } from "react";
import { Bell, CalendarClock, Check, CircleAlert, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import DataTable from "./DataTable";

type FollowUpRow = inferRouterOutputs<AppRouter>["fieldOps"]["followUps"]["list"][number];
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const formatDate = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
const nextDays = (days: number) => { const value = new Date(`${today()}T12:00:00+05:30`); value.setDate(value.getDate() + days); return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(value); };

export default function FollowUpsView() {
  const [empCode, setEmpCode] = useState("ALL");
  const [status, setStatus] = useState("Pending");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [newDate, setNewDate] = useState(today());
  const employees = trpc.fieldOps.employees.list.useQuery({ includeInactive: true });
  const utils = trpc.useUtils();
  const filter = { ...(empCode === "ALL" ? {} : { empCode }), ...(status === "ALL" ? {} : { status: status as "Pending" | "Done" | "Rescheduled" | "Cancelled" }), ...(from ? { from } : {}), ...(to ? { to } : {}) };
  const followUps = trpc.fieldOps.followUps.list.useQuery(filter);
  const due = trpc.fieldOps.followUps.dueSummary.useQuery(empCode === "ALL" ? {} : { empCode }, { refetchInterval: 60_000 });
  const markDone = trpc.fieldOps.followUps.markDone.useMutation({ onSuccess: async () => { toast.success("Follow-up marked done"); await utils.invalidate(); } });
  const cancel = trpc.fieldOps.followUps.cancel.useMutation({ onSuccess: async () => { toast.success("Follow-up cancelled"); await utils.invalidate(); } });
  const reschedule = trpc.fieldOps.followUps.reschedule.useMutation({ onSuccess: async () => { setRescheduleId(null); toast.success("Follow-up rescheduled"); await utils.invalidate(); }, onError: error => toast.error(error.message) });

  useEffect(() => { if (!("serviceWorker" in navigator)) return; void navigator.serviceWorker.register("/service-worker.js").catch(() => undefined); }, []);
  useEffect(() => {
    if (!due.data?.length || !("Notification" in window) || Notification.permission !== "granted" || !("serviceWorker" in navigator)) return;
    const local = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    if (local.slice(0, 5) < "09:00") return;
    const key = `fielddesk-followup-notice:${today()}:${empCode}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "sent");
    void navigator.serviceWorker.ready.then(registration => registration.showNotification(`${due.data.length} follow-up${due.data.length === 1 ? "" : "s"} due`, { body: due.data.slice(0, 3).map(item => item.customerName).join(" · "), icon: "/favicon.ico", tag: key, data: { url: "/" } }));
  }, [due.data, empCode]);

  const enableNotifications = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) { toast.error("This browser does not support web notifications."); return; }
    try { const permission = await Notification.requestPermission(); if (permission !== "granted") { toast.error("Notification permission was not granted."); return; } const registration = await navigator.serviceWorker.ready; if (due.data?.length) await registration.showNotification(`${due.data.length} follow-up${due.data.length === 1 ? "" : "s"} due`, { body: due.data.slice(0, 3).map(item => item.customerName).join(" · "), icon: "/favicon.ico", data: { url: "/" } }); toast.success("Browser reminders enabled while FieldDesk is open."); }
    catch { toast.error("Couldn’t enable browser reminders."); }
  };
  const columns = [
    { key: "empCode", label: "Emp Code", sortValue: (row: FollowUpRow) => row.empCode ?? "", render: (row: FollowUpRow) => row.empCode ?? "Unmapped" },
    { key: "customerName", label: "Customer", sortValue: (row: FollowUpRow) => row.customerName, render: (row: FollowUpRow) => <strong>{row.customerName}</strong> },
    { key: "followUpDate", label: "Follow-up date", sortValue: (row: FollowUpRow) => row.followUpDate, exportValue: (row: FollowUpRow) => row.followUpDate, render: (row: FollowUpRow) => formatDate(row.followUpDate) },
    { key: "followUpTime", label: "Time", sortValue: (row: FollowUpRow) => row.followUpTime ?? "", exportValue: (row: FollowUpRow) => row.followUpTime ?? "", render: (row: FollowUpRow) => row.followUpTime ?? "—" },
    { key: "note", label: "Next step", sortValue: (row: FollowUpRow) => row.note ?? "", exportValue: (row: FollowUpRow) => row.note ?? "", render: (row: FollowUpRow) => row.note ?? "—" },
    { key: "status", label: "Status", sortValue: (row: FollowUpRow) => row.status, render: (row: FollowUpRow) => <span className={`employee-status ${row.status === "Pending" ? "active" : "inactive"}`}>{row.status}</span> },
    { key: "actions", label: "Actions", render: (row: FollowUpRow) => row.status !== "Pending" ? "—" : <div className="followup-actions"><button className="button button-small button-primary" onClick={() => markDone.mutate({ id: row.id })} disabled={markDone.isPending}><Check size={14} /> Done</button><button className="icon-button" aria-label="Reschedule" onClick={() => { setRescheduleId(row.id); setNewDate(row.followUpDate); }}><RotateCcw size={15} /></button><button className="icon-button" aria-label="Cancel follow-up" onClick={() => cancel.mutate({ id: row.id })} disabled={cancel.isPending}><X size={15} /></button><button className="button button-small" onClick={() => { localStorage.setItem("fielddesk:followup-prefill", JSON.stringify({ empCode: row.empCode, customerName: row.customerName })); window.dispatchEvent(new Event("fielddesk:open-followup-log")); }}>Log visit</button>{rescheduleId === row.id && <div className="followup-reschedule"><label>New date <input type="date" min={today()} value={newDate} onChange={event => setNewDate(event.target.value)} /></label><button className="button button-secondary button-small" onClick={() => reschedule.mutate({ id: row.id, followUpDate: newDate, followUpTime: row.followUpTime })} disabled={reschedule.isPending}>Save</button><button className="button button-small" onClick={() => setRescheduleId(null)}>Cancel</button></div>}</div> },
  ];

  return <div className="view-stack followups-view">
    <div className="page-heading"><div><p className="eyebrow">CUSTOMER FOLLOW-THROUGH</p><h1>Follow-ups.</h1><p className="page-subtitle">Reminders are linked to customer visits. Pending reminders due today or earlier appear at the top.</p></div><div className="report-icon"><CalendarClock size={20} /></div></div>
    <section className="panel"><div className="followup-summary"><div><p className="eyebrow">DUE NOW</p><strong>{due.data?.length ?? 0}</strong><span>pending reminder{due.data?.length === 1 ? "" : "s"} · India time</span></div><button className="button button-secondary" onClick={() => void enableNotifications()}><Bell size={15} /> Enable browser reminders</button></div></section>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">REMINDER QUEUE</p><h2>Customer next steps</h2></div><span className="panel-count">{followUps.data?.length ?? 0} reminders</span></div><div className="plan-sheet-controls"><label className="filter-select"><span>Employee</span><select value={empCode} onChange={event => setEmpCode(event.target.value)}><option value="ALL">All employees</option>{(employees.data ?? []).map(employee => <option key={employee.empCode} value={employee.empCode}>{employee.empCode} · {employee.employeeName}</option>)}</select></label><label className="filter-select"><span>Status</span><select value={status} onChange={event => setStatus(event.target.value)}>{["Pending", "Done", "Rescheduled", "Cancelled", "ALL"].map(value => <option key={value} value={value}>{value === "ALL" ? "All statuses" : value}</option>)}</select></label><label className="filter-select"><span>From</span><input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label className="filter-select"><span>To</span><input type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div>
      {followUps.isLoading ? <div className="report-loading"><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /></div> : followUps.isError ? <div className="error-block"><strong>Couldn’t load reminders.</strong><button className="button button-secondary button-small" onClick={() => void followUps.refetch()}>Try again</button></div> : <DataTable rows={followUps.data ?? []} columns={columns} exportName="customer-follow-ups" emptyTitle="No reminders in this view" emptyDescription="Add a follow-up while logging a daily customer visit." />}
    </section>
  </div>;
}
