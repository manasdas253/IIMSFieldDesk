import { useMemo, useState } from "react";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { indiaDateString, VISIT_PURPOSES } from "@shared/fieldOps";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import DataTable from "./DataTable";
import { formatINR } from "./Reports";

type VisitRow = inferRouterOutputs<AppRouter>["fieldOps"]["visits"]["list"][number];

function mondayOfWeek(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const monday = new Date(Date.UTC(year, month - 1, day));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function sundayOfWeek(monday: string): string {
  const sunday = new Date(`${monday}T00:00:00Z`);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return sunday.toISOString().slice(0, 10);
}

function dateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}

function distanceLabel(value: number): string {
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value)} km`;
}

const columns = [
  { key: "employeeName", label: "Employee", sortValue: (row: VisitRow) => row.employeeName, exportValue: (row: VisitRow) => row.employeeName, render: (row: VisitRow) => <strong className="table-primary-text">{row.employeeName}</strong> },
  { key: "visitDate", label: "Date", sortValue: (row: VisitRow) => row.visitDate, exportValue: (row: VisitRow) => row.visitDate, render: (row: VisitRow) => dateLabel(row.visitDate) },
  { key: "customerName", label: "Customer", sortValue: (row: VisitRow) => row.customerName, exportValue: (row: VisitRow) => row.customerName, render: (row: VisitRow) => row.customerName },
  { key: "location", label: "Location / City", sortValue: (row: VisitRow) => row.location, exportValue: (row: VisitRow) => row.location, render: (row: VisitRow) => <span className="table-location"><MapPin size={13} />{row.location}</span> },
  { key: "purpose", label: "Purpose", sortValue: (row: VisitRow) => row.purpose, exportValue: (row: VisitRow) => row.purpose, render: (row: VisitRow) => row.purpose },
  { key: "travelMode", label: "Travel Mode", sortValue: (row: VisitRow) => row.travelMode, exportValue: (row: VisitRow) => row.travelMode, render: (row: VisitRow) => row.travelMode },
  { key: "distanceKm", label: "Distance", sortValue: (row: VisitRow) => Number(row.distanceKm), exportValue: (row: VisitRow) => Number(row.distanceKm), render: (row: VisitRow) => distanceLabel(Number(row.distanceKm)) },
  { key: "travelCost", label: "Travel Cost", sortValue: (row: VisitRow) => Number(row.travelCost), exportValue: (row: VisitRow) => Number(row.travelCost), render: (row: VisitRow) => <strong className="amount-cell">{formatINR(row.travelCost)}</strong> },
  { key: "outcome", label: "Outcome", sortValue: (row: VisitRow) => row.outcome, exportValue: (row: VisitRow) => row.outcome, render: (row: VisitRow) => row.outcome },
];

export default function WeeklyVisitsView() {
  const [weekStarting, setWeekStarting] = useState(() => mondayOfWeek(indiaDateString()));
  const [employeeName, setEmployeeName] = useState("");
  const [purpose, setPurpose] = useState("");
  const weekEnding = useMemo(() => sundayOfWeek(weekStarting), [weekStarting]);
  const visits = trpc.fieldOps.visits.list.useQuery({ from: weekStarting, to: weekEnding });
  const employees = trpc.fieldOps.employeeNames.useQuery();

  const filteredVisits = useMemo(() => (visits.data ?? []).filter(row =>
    (!employeeName || row.employeeName === employeeName) && (!purpose || row.purpose === purpose),
  ), [employeeName, purpose, visits.data]);

  const totals = useMemo(() => filteredVisits.reduce((summary, row) => ({
    visits: summary.visits + 1,
    distance: summary.distance + Number(row.distanceKm),
    cost: summary.cost + Number(row.travelCost),
  }), { visits: 0, distance: 0, cost: 0 }), [filteredVisits]);

  const employeeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of filteredVisits) counts.set(row.employeeName, (counts.get(row.employeeName) ?? 0) + 1);
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [filteredVisits]);

  const handleWeekChange = (value: string) => {
    if (value) setWeekStarting(mondayOfWeek(value));
  };

  return <div className="view-stack">
    <div className="page-heading"><div><p className="eyebrow">WEEKLY FIELD ACTIVITY</p><h1>Weekly visits.</h1><p className="page-subtitle">A single view of the team’s daily logs for Monday through Sunday.</p></div><div className="report-icon"><CalendarDays size={20} /></div></div>

    <div className="report-filter-card">
      <label className="filter-select"><span>Week of Monday</span><input type="date" value={weekStarting} onChange={event => handleWeekChange(event.target.value)} aria-label="Choose a date in the week to view" /></label>
      <label className="filter-select"><span>Employee</span><select value={employeeName} onChange={event => setEmployeeName(event.target.value)}><option value="">All employees</option>{(employees.data ?? []).map(name => <option key={name} value={name}>{name}</option>)}</select></label>
      <label className="filter-select"><span>Purpose</span><select value={purpose} onChange={event => setPurpose(event.target.value)}><option value="">All purposes</option>{VISIT_PURPOSES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    </div>

    <div className="report-summary-row" aria-label="Weekly visit totals">
      <div className="summary-tile"><span>Total visits</span><strong>{totals.visits}</strong></div>
      <div className="summary-tile"><span>Total distance</span><strong>{distanceLabel(totals.distance)}</strong></div>
      <div className="summary-tile"><span>Total travel cost</span><strong>{formatINR(totals.cost)}</strong></div>
    </div>

    <section className="panel">
      <div className="panel-heading"><div><p className="eyebrow">VISITS BY EMPLOYEE</p><h2>Weekly visit counts</h2></div><span className="panel-count">{dateLabel(weekStarting)} — {dateLabel(weekEnding)}</span></div>
      {visits.isLoading ? <div className="report-loading" aria-label="Loading weekly visit counts"><div className="skeleton skeleton-wide" /><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /></div> : visits.isError ? <div className="empty-state"><div className="empty-mark"><Users size={19} /></div><strong>Couldn’t load weekly visits</strong><p>Try again after checking your connection.</p><button className="button button-secondary button-small" onClick={() => void visits.refetch()}>Retry</button></div> : employeeCounts.length ? <div className="status-summary">{employeeCounts.map(([name, count]) => <span key={name}><Users size={14} />{name}<strong>{count}</strong> {count === 1 ? "visit" : "visits"}</span>)}</div> : <div className="empty-state"><div className="empty-mark"><Users size={19} /></div><strong>No visits match these filters</strong><p>Choose another week or broaden the employee and purpose filters.</p></div>}
    </section>

    <section className="panel">
      <div className="panel-heading"><div><p className="eyebrow">DAILY VISIT LOG</p><h2>Visits recorded this week</h2></div><span className="panel-count">{filteredVisits.length} {filteredVisits.length === 1 ? "visit" : "visits"}</span></div>
      {visits.isLoading ? <div className="report-loading" aria-label="Loading weekly visits"><div className="skeleton skeleton-wide" /><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /></div> : visits.isError ? <div className="empty-state"><strong>Couldn’t load this report.</strong><p>Check your connection and try again.</p><button className="button button-secondary button-small" onClick={() => void visits.refetch()}>Retry</button></div> : <DataTable rows={filteredVisits} columns={columns} exportName={`weekly-visits-${weekStarting}`} emptyTitle="No visits logged this week" emptyDescription="Daily visit logs for this Monday–Sunday week will appear here." />}
    </section>
  </div>;
}
