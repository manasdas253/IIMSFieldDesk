import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { trpc } from "@/lib/trpc";
import DataTable from "./DataTable";

type Row = inferRouterOutputs<AppRouter>["fieldOps"]["dailyVisit"]["statusList"][number];
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default function DailyStatusView() {
  const user = useCurrentUser();
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const rows = trpc.fieldOps.dailyVisit.statusList.useQuery({ from, to });
  const workload = trpc.fieldOps.dailyVisit.workload.useQuery({ from, to });
  const columns: Array<{ key: string; label: string; sortValue: (row: Row) => string | number; render: (row: Row) => React.ReactNode }> = [
    { key: "visitDate", label: "Date", sortValue: (row: Row) => row.visitDate, render: row => row.visitDate },
    { key: "employeeName", label: "Employee", sortValue: (row: Row) => row.employeeName, render: row => row.employeeName },
    { key: "customerName", label: "Customer", sortValue: (row: Row) => row.customerName, render: (row: Row) => <strong>{row.customerName}</strong> },
    { key: "status", label: "Daily status", sortValue: (row: Row) => row.status, render: (row: Row) => row.status === "Rescheduled" ? `Rescheduled to ${row.newDate ?? "date pending"}` : row.status === "Planned" ? `Moved from ${row.originalPlannedDate ?? "unknown date"}` : row.status },
    { key: "reason", label: "Reason", sortValue: (row: Row) => row.reason ?? "", render: (row: Row) => row.reason ?? "—" },
    { key: "newDate", label: "Moved date", sortValue: (row: Row) => row.newDate ?? "", render: (row: Row) => row.newDate ?? "—" },
    { key: "originalPlannedDate", label: "Originally planned", sortValue: (row: Row) => row.originalPlannedDate ?? "", render: (row: Row) => row.originalPlannedDate ?? "Unplanned" },
    { key: "source", label: "Source", sortValue: (row: Row) => row.source, render: row => row.source },
    { key: "lateEntry", label: "Entry", sortValue: (row: Row) => Number(row.lateEntry), render: (row: Row) => row.lateEntry ? "Late entry" : "On time" },
    { key: "notes", label: "Notes", sortValue: (row: Row) => row.notes ?? "", render: (row: Row) => row.notes ?? "—" },
  ];
  return <div className="view-stack"><div className="page-heading"><div><p className="eyebrow">DAILY PLAN STATUS</p><h1>Daily visit status.</h1><p className="page-subtitle">Visited, missed, moved, and unplanned visits appear here; this view does not feed existing reports or KPIs.</p></div></div><section className="panel"><div className="plan-sheet-controls"><label className="filter-select"><span>From</span><input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label className="filter-select"><span>To</span><input type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div><div className="panel-heading"><div><p className="eyebrow">BUSY DAYS</p><h2>More than five planned visits</h2></div><span className="panel-count">{workload.data?.filter(item => item.overloaded).length ?? 0} overloaded days</span></div>{workload.data?.some(item => item.overloaded) ? <div className="daily-stop-list">{workload.data.filter(item => item.overloaded).map(item => <article className="daily-stop" key={`${item.empCode}-${item.date}`}><div><strong>{item.date} · {item.employeeName}</strong><small>{item.empCode} · {item.plannedVisits} planned visits</small></div><span className="employee-status inactive">Warning</span></article>)}</div> : <p className="page-subtitle">No overloaded days in this range.</p>}</section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">DAILY RESPONSES</p><h2>Visited, missed, moved and unplanned</h2></div></div>{rows.isLoading ? <p className="page-subtitle">Loading daily statuses…</p> : <DataTable rows={rows.data ?? []} columns={columns} exportName={user?.role === "admin" ? "daily-visit-status" : `daily-visit-status-${user?.empCode ?? "employee"}`} emptyTitle="No daily statuses yet" emptyDescription="Visited, missed, rescheduled, and unplanned visits will be listed here." />}</section></div>;
}
