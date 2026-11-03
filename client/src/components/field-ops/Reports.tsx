import { useCallback, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, CircleDollarSign, ListChecks, MapPin, Users, ClipboardList, RefreshCw, Filter, Check } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { indiaDateString, nextMondayDate, TRAVEL_MODES, VISIT_PURPOSES } from "@shared/fieldOps";
import DataTable from "./DataTable";
import OverviewMapSection from "./OverviewMapSection";
import { normalizeVisitCity } from "./indiaMapData";
import OverviewKpiDetails, { type OverviewKpiKey } from "./OverviewKpiDetails";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";

type Outputs = inferRouterOutputs<AppRouter>;
type VisitRow = Outputs["fieldOps"]["visits"]["list"][number];
type PlanActualRow = Outputs["fieldOps"]["reports"]["planVsActual"][number];

export function formatINR(value: number | string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}
function dateLabel(date: string) {
  if (!date) return "—";
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}
function monthLabel(month: string) {
  const [year, mm] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "short" }).format(new Date(year, mm - 1, 1));
}
function StatusBadge({ value }: { value: string }) {
  const tone = /no-show|no response|pending|unplanned/i.test(value) ? "warning" : /visited|positive|closed/i.test(value) ? "good" : "neutral";
  return <span className={`status-badge ${tone}`}><i />{value}</span>;
}
function LoadingBlock({ label = "Loading report" }: { label?: string }) { return <div className="report-loading" aria-label={label}><div className="skeleton skeleton-wide" /><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /></div>; }
function ErrorBlock({ onRetry }: { onRetry: () => void }) { return <div className="error-block"><strong>Couldn’t load this report.</strong><span>Check your connection and try again.</span><button className="button button-secondary button-small" onClick={onRetry}><RefreshCw size={14} /> Retry</button></div>; }
function DateRange({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (value: string) => void; onTo: (value: string) => void }) {
  return <div className="date-range"><label><span>From</span><input type="date" value={from} onChange={event => onFrom(event.target.value)} /></label><label><span>To</span><input type="date" value={to} onChange={event => onTo(event.target.value)} /></label></div>;
}

const visitColumns = [
  { key: "visitDate", label: "Date", sortValue: (row: VisitRow) => row.visitDate, render: (row: VisitRow) => dateLabel(row.visitDate) },
  { key: "employeeName", label: "Employee", sortValue: (row: VisitRow) => row.employeeName, render: (row: VisitRow) => <strong className="table-primary-text">{row.employeeName}</strong> },
  { key: "customerName", label: "Customer", sortValue: (row: VisitRow) => row.customerName, render: (row: VisitRow) => <span>{row.customerName}</span> },
  { key: "location", label: "Location", sortValue: (row: VisitRow) => row.location, render: (row: VisitRow) => <span className="table-location"><MapPin size={13} />{row.location}</span> },
  { key: "purpose", label: "Purpose", sortValue: (row: VisitRow) => row.purpose, render: (row: VisitRow) => row.purpose },
  { key: "outcome", label: "Outcome", sortValue: (row: VisitRow) => row.outcome, render: (row: VisitRow) => <StatusBadge value={row.outcome} /> },
  { key: "travelCost", label: "Travel cost", sortValue: (row: VisitRow) => Number(row.travelCost), exportValue: (row: VisitRow) => Number(row.travelCost), render: (row: VisitRow) => <strong className="amount-cell">{formatINR(row.travelCost)}</strong> },
];
const todayVisitColumns = [
  ...visitColumns.slice(0, 3),
  { key: "visitedPersonName", label: "Visited person", sortValue: (row: VisitRow) => row.visitedPersonName ?? "", render: (row: VisitRow) => row.visitedPersonName || "—" },
  ...visitColumns.slice(3, 6),
  { key: "notes", label: "Notes", sortValue: (row: VisitRow) => row.notes ?? "", render: (row: VisitRow) => row.notes || "—" },
];

export function OverviewView({ onViewWeeklyPlan, onViewAllVisits, onViewFollowUps }: { onViewWeeklyPlan: () => void; onViewAllVisits: () => void; onViewFollowUps: () => void }) {
  const stats = trpc.fieldOps.reports.overview.useQuery();
  const todayDate = indiaDateString();
  const today = trpc.fieldOps.visits.list.useQuery({ from: todayDate, to: todayDate });
  const followUpsDue = trpc.fieldOps.followUps.dueSummary.useQuery({}, { refetchInterval: 60_000 });
  const [activeKpi, setActiveKpi] = useState<OverviewKpiKey | null>(null);
  const [selectedMapCity, setSelectedMapCity] = useState<string | null>(null);
  const [mapFocusRequest, setMapFocusRequest] = useState(0);
  const handleTodayVisitClick = useCallback((row: VisitRow) => {
    setSelectedMapCity(normalizeVisitCity(row.location));
    setMapFocusRequest(request => request + 1);
  }, []);
  const isMapSelectedVisit = useCallback((row: VisitRow) => selectedMapCity === normalizeVisitCity(row.location), [selectedMapCity]);
  const data = stats.data;
  const kpis = [
    { key: "visitsToday" as const, label: "Visits today", value: data?.visitsToday ?? 0, note: "Logged across the team", icon: MapPin, tone: "orange", tag: "TODAY" },
    { key: "activeField" as const, label: "Active in field", value: data?.activeEmployees ?? 0, note: "Employees with a visit today", icon: Users, tone: "blue", tag: "TODAY" },
    { key: "monthlyCost" as const, label: "Travel cost · MTD", value: formatINR(data?.monthlyCost ?? 0), note: "Recorded this month", icon: CircleDollarSign, tone: "green", tag: "MTD" },
    { key: "pendingPlans" as const, label: "Pending plans", value: data?.pendingPlans ?? 0, note: "Upcoming weekly submissions", icon: ClipboardList, tone: "violet", tag: "WEEKLY" },
    { key: "totalVisitsToDate" as const, label: "Total visits to date", value: data?.totalVisitsToDate ?? 0, note: "All visits through today", icon: ListChecks, tone: "blue", tag: "ALL TIME" },
    { key: "followUpsDue" as const, label: "Follow-ups due today", value: followUpsDue.data?.length ?? 0, note: `${followUpsDue.data?.filter(row => row.followUpDate < todayDate).length ?? 0} overdue`, icon: CalendarDays, tone: "orange", tag: "TODAY" },
  ];
  const followUpNote = kpis.find(card => card.key === "followUpsDue")?.note ?? "0 overdue";
  const overdueLabel = followUpNote.replace(" overdue", " follow-ups overdue");
  const hasOverdue = !followUpNote.startsWith("0 ");

  return <div className="view-stack overview-dashboard">
    <section className="page-heading overview-heading">
      <div className="overview-hero-copy"><p className="eyebrow">OPERATIONS OVERVIEW</p><h1>A clear view of the field.</h1><p className="page-subtitle">Today’s activity, travel spend, and the route ahead.</p></div>
      <div className="overview-header-meta">
        <div className="capture-date overview-date"><div className="overview-date-icon"><CalendarDays size={16} /></div><div><span>INDIA STANDARD TIME</span><strong>{dateLabel(data?.today ?? todayDate)}</strong></div></div>
        <span className={`overview-overdue-status${hasOverdue ? " is-overdue" : ""}`} role="status"><i className="overview-status-dot" />{overdueLabel}</span>
      </div>
    </section>
    {stats.isLoading ? <div className="kpi-grid">{kpis.map(card => <div className="kpi-card skeleton-kpi" key={card.key}><div className="skeleton skeleton-icon" /><div className="skeleton skeleton-row" /><div className="skeleton skeleton-number" /></div>)}</div> : stats.isError ? <ErrorBlock onRetry={() => void stats.refetch()} /> : <div className="kpi-grid">{kpis.map(card => { const Icon = card.icon; return <button type="button" className="kpi-card kpi-card-action" data-tone={card.tone} key={card.key} onClick={() => card.key === "followUpsDue" ? onViewFollowUps() : card.key === "totalVisitsToDate" ? onViewAllVisits() : setActiveKpi(card.key)} aria-label={card.key === "followUpsDue" ? "View follow-ups due today" : card.key === "totalVisitsToDate" ? "View details for all visits through today" : `View details for ${card.label}`}>
      <span className="kpi-top-row"><span className={`kpi-icon ${card.tone}`}><Icon size={18} /></span><span className="kpi-time-tag">{card.tag}</span></span>
      <span className="kpi-label">{card.label}</span><strong className="kpi-value">{card.value}</strong><span className="kpi-note">{card.note}</span>
      {card.key === "followUpsDue" && <span className="kpi-followup-badge"><Check size={12} aria-hidden="true" />Follow-ups tracked</span>}
      <span className="kpi-action-hint">View details</span><ArrowUpRight className="kpi-action-arrow" size={15} aria-hidden="true" />
    </button>; })}</div>}
    <div className="overview-grid"><section className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">TRAVEL SPEND</p><h2>Six-month cost trend</h2></div><span className="panel-chip"><Activity size={14} /> INR</span></div>{stats.isLoading ? <div className="chart-skeleton skeleton" /> : <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data?.trend ?? []} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D71920" stopOpacity={0.2} /><stop offset="95%" stopColor="#D71920" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid stroke="#ece8e1" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="month" tickFormatter={monthLabel} axisLine={false} tickLine={false} tick={{ fill: "#8d8a83", fontSize: 12 }} /><YAxis tickFormatter={value => value >= 1000 ? `₹${Math.round(value / 1000)}k` : `₹${value}`} axisLine={false} tickLine={false} tick={{ fill: "#8d8a83", fontSize: 11 }} /><Tooltip formatter={value => [formatINR(Number(value)), "Travel cost"]} labelFormatter={label => monthLabel(String(label))} contentStyle={{ borderRadius: 12, border: "1px solid #ece8e1", boxShadow: "0 8px 24px #18231b12" }} /><Area type="monotone" dataKey="total" stroke="#D71920" strokeWidth={2.5} fill="url(#costFill)" activeDot={{ r: 5, strokeWidth: 0 }} /></AreaChart></ResponsiveContainer></div>}</section>
      <section className="panel field-note-panel"><div className="field-note-mark"><CalendarDays size={20} /></div><p className="eyebrow">THIS WEEK</p><h2>Keep the route moving.</h2><p>Plans and actual visits stay side by side, so teams can spot gaps early and adjust with confidence.</p><div className="note-rule" /><span>Make every stop count.</span><button type="button" className="button button-secondary week-plan-cta" onClick={onViewWeeklyPlan}><span>View weekly plan</span><ArrowUpRight size={15} /></button></section></div>
    {!today.isError && <OverviewMapSection visits={today.data ?? []} selectedCityKey={selectedMapCity} focusRequest={mapFocusRequest} onCitySelect={setSelectedMapCity} loading={today.isLoading} />}
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">RECENT FIELD ACTIVITY</p><h2>Today’s visits</h2></div><span className="panel-count">{today.data?.length ?? 0} {today.data?.length === 1 ? "visit" : "visits"}</span></div>{today.isLoading ? <LoadingBlock label="Loading today's visits" /> : today.isError ? <ErrorBlock onRetry={() => void today.refetch()} /> : <DataTable rows={(today.data ?? []).slice(0, 8)} columns={todayVisitColumns} exportName="field-visits-today" emptyTitle="No visits logged today" emptyDescription="When field visits are logged, they’ll appear here." onRowClick={handleTodayVisitClick} isRowSelected={isMapSelectedVisit} />}</section>
    <OverviewKpiDetails kind={activeKpi} todayDate={data?.today ?? todayDate} kpiValue={kpis.find(card => card.key === activeKpi)?.value ?? "—"} visits={today.data ?? []} visitsLoading={today.isLoading} visitsError={today.isError} onRetryVisits={() => void today.refetch()} onClose={() => setActiveKpi(null)} />
  </div>;
}

export function TodayVisitsView() {
  const today = indiaDateString();
  const [employeeName, setEmployeeName] = useState("");
  const [location, setLocation] = useState("");
  const [purpose, setPurpose] = useState("");
  const employees = trpc.fieldOps.employeeNames.useQuery();
  const visits = trpc.fieldOps.visits.list.useQuery({ from: today, to: today, employeeName: employeeName || undefined, location: location || undefined, purpose: purpose ? purpose as typeof VISIT_PURPOSES[number] : undefined });
  return <div className="view-stack"><div className="page-heading"><div><p className="eyebrow">FIELD ACTIVITY</p><h1>Today’s visits.</h1><p className="page-subtitle">See where the team has been and what came of each stop.</p></div><div className="capture-date"><span>DATE</span><strong>{dateLabel(today)}</strong></div></div>
    <div className="filter-strip"><span className="filter-label"><Filter size={15} /> Filter by</span><select value={employeeName} onChange={event => setEmployeeName(event.target.value)}><option value="">All employees</option>{(employees.data ?? []).map(name => <option key={name}>{name}</option>)}</select><input className="location-filter" value={location} onChange={event => setLocation(event.target.value)} placeholder="Location or city" /><select value={purpose} onChange={event => setPurpose(event.target.value)}><option value="">All purposes</option>{VISIT_PURPOSES.map(value => <option key={value}>{value}</option>)}</select></div>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">DAILY LOG</p><h2>Visits recorded</h2></div><span className="panel-count">{visits.data?.length ?? 0} records</span></div>{visits.isLoading ? <LoadingBlock /> : visits.isError ? <ErrorBlock onRetry={() => void visits.refetch()} /> : <DataTable rows={visits.data ?? []} columns={visitColumns} exportName="todays-visits" emptyTitle="No visits for these filters" emptyDescription="Try a different employee, location, or purpose." />}</section>
  </div>;
}

export function EmployeeReportView() {
  const today = indiaDateString();
  const [employeeName, setEmployeeName] = useState("");
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const employees = trpc.fieldOps.employeeNames.useQuery();
  const report = trpc.fieldOps.reports.employee.useQuery({ employeeName, from, to }, { enabled: Boolean(employeeName) });
  return <div className="view-stack"><div className="page-heading"><div><p className="eyebrow">TEAM PERFORMANCE</p><h1>Employee report.</h1><p className="page-subtitle">Drill into customer visits and travel cost across a chosen period.</p></div><div className="report-icon"><Users size={20} /></div></div>
    <div className="report-filter-card"><label className="filter-select"><span>Employee</span><select value={employeeName} onChange={event => setEmployeeName(event.target.value)}><option value="">Select an employee…</option>{(employees.data ?? []).map(name => <option key={name}>{name}</option>)}</select></label><DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} /></div>
    {!employeeName ? <div className="empty-state report-empty"><div className="empty-mark"><Users size={21} /></div><strong>Choose an employee</strong><p>Select a team member to see their visit history, customers, and cost.</p></div> : report.isLoading ? <LoadingBlock /> : report.isError ? <ErrorBlock onRetry={() => void report.refetch()} /> : <><div className="report-summary-row"><div className="summary-tile"><span>Visits in range</span><strong>{report.data?.totalVisits ?? 0}</strong></div><div className="summary-tile"><span>Customers visited</span><strong>{report.data?.customers ?? 0}</strong></div><div className="summary-tile"><span>Travel cost</span><strong>{formatINR(report.data?.totalCost ?? 0)}</strong></div></div><section className="panel"><div className="panel-heading"><div><p className="eyebrow">EMPLOYEE ACTIVITY</p><h2>{employeeName}</h2></div><span className="panel-count">{dateLabel(from)} — {dateLabel(to)}</span></div><DataTable rows={report.data?.visits ?? []} columns={visitColumns} exportName={`employee-report-${employeeName.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`} emptyTitle="No visits in this date range" /></section></>}
  </div>;
}

export function CostSummaryView() {
  const today = indiaDateString();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const report = trpc.fieldOps.reports.costSummary.useQuery({ from, to });
  const columns = [
    { key: "employeeName", label: "Employee", sortValue: (row: NonNullable<typeof report.data>[number]) => row.employeeName, render: (row: NonNullable<typeof report.data>[number]) => <strong className="table-primary-text">{row.employeeName}</strong> },
    { key: "month", label: "Month", sortValue: (row: NonNullable<typeof report.data>[number]) => row.month, render: (row: NonNullable<typeof report.data>[number]) => monthLabel(row.month) },
    { key: "visitCount", label: "Visits", sortValue: (row: NonNullable<typeof report.data>[number]) => row.visitCount, render: (row: NonNullable<typeof report.data>[number]) => row.visitCount },
    { key: "totalCost", label: "Total cost", sortValue: (row: NonNullable<typeof report.data>[number]) => row.totalCost, exportValue: (row: NonNullable<typeof report.data>[number]) => row.totalCost, render: (row: NonNullable<typeof report.data>[number]) => <strong className="amount-cell">{formatINR(row.totalCost)}</strong> },
    { key: "averageCost", label: "Average / visit", sortValue: (row: NonNullable<typeof report.data>[number]) => row.averageCost, exportValue: (row: NonNullable<typeof report.data>[number]) => Math.round(row.averageCost * 100) / 100, render: (row: NonNullable<typeof report.data>[number]) => formatINR(row.averageCost) },
  ];
  const total = (report.data ?? []).reduce((sum, row) => sum + row.totalCost, 0);
  return <div className="view-stack"><div className="page-heading"><div><p className="eyebrow">TRAVEL EXPENSES</p><h1>Cost summary.</h1><p className="page-subtitle">Monthly travel cost by employee, with totals and average spend.</p></div><div className="report-icon cost"><CircleDollarSign size={20} /></div></div><div className="report-filter-card"><div className="filter-summary"><span>Travel cost total</span><strong>{formatINR(total)}</strong></div><DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} /></div><section className="panel"><div className="panel-heading"><div><p className="eyebrow">EMPLOYEE × MONTH</p><h2>Travel cost breakdown</h2></div><span className="panel-chip">INR</span></div>{report.isLoading ? <LoadingBlock /> : report.isError ? <ErrorBlock onRetry={() => void report.refetch()} /> : <DataTable rows={report.data ?? []} columns={columns} exportName="travel-cost-summary" emptyTitle="No travel cost recorded" emptyDescription="Submitted visit logs will roll up into this report." />}</section></div>;
}

export function PlanVsActualView() {
  const start = nextMondayDate();
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(() => { const d = new Date(`${start}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); });
  const report = trpc.fieldOps.reports.planVsActual.useQuery({ from, to });
  const employees = trpc.fieldOps.employeeNames.useQuery();
  const [employeeName, setEmployeeName] = useState("");
  const rows = useMemo(() => (report.data ?? []).filter(row => !employeeName || row.employeeName === employeeName), [employeeName, report.data]);
  const columns = [
    { key: "employeeName", label: "Employee", sortValue: (row: PlanActualRow) => row.employeeName, render: (row: PlanActualRow) => <strong className="table-primary-text">{row.employeeName}</strong> },
    { key: "weekStartingDate", label: "Week of", sortValue: (row: PlanActualRow) => row.weekStartingDate, render: (row: PlanActualRow) => dateLabel(row.weekStartingDate) },
    { key: "plannedCustomerName", label: "Planned customer", sortValue: (row: PlanActualRow) => row.plannedCustomerName, render: (row: PlanActualRow) => row.plannedCustomerName || "—" },
    { key: "actualCustomerName", label: "Actual customer", sortValue: (row: PlanActualRow) => row.actualCustomerName, render: (row: PlanActualRow) => row.actualCustomerName || "—" },
    { key: "plannedLocation", label: "Planned location", sortValue: (row: PlanActualRow) => row.plannedLocation, render: (row: PlanActualRow) => row.plannedLocation || "—" },
    { key: "actualLocation", label: "Actual location", sortValue: (row: PlanActualRow) => row.actualLocation, render: (row: PlanActualRow) => row.actualLocation || "—" },
    { key: "actualDate", label: "Actual date", sortValue: (row: PlanActualRow) => row.actualDate, render: (row: PlanActualRow) => row.actualDate ? dateLabel(row.actualDate) : "—" },
    { key: "actualOutcome", label: "Actual outcome", sortValue: (row: PlanActualRow) => row.actualOutcome, render: (row: PlanActualRow) => row.actualOutcome || "—" },
    { key: "status", label: "Status", sortValue: (row: PlanActualRow) => row.status, render: (row: PlanActualRow) => <StatusBadge value={row.status} /> },
  ];
  const noShows = rows.filter(row => row.status === "No-show").length;
  const unplanned = rows.filter(row => row.status === "Unplanned").length;
  return <div className="view-stack"><div className="page-heading"><div><p className="eyebrow">PLAN VS ACTUAL</p><h1>Planned against reality.</h1><p className="page-subtitle">Spot completed stops, no-shows, and visits outside the weekly plan.</p></div><div className="report-icon"><RefreshCw size={20} /></div></div><div className="report-filter-card"><DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} /><label className="filter-select"><span>Employee</span><select value={employeeName} onChange={event => setEmployeeName(event.target.value)}><option value="">All employees</option>{(employees.data ?? []).map(name => <option key={name}>{name}</option>)}</select></label></div>{!report.isLoading && !report.isError && <div className="status-summary"><span><StatusBadge value="No-show" /> <strong>{noShows}</strong></span><span><StatusBadge value="Unplanned" /> <strong>{unplanned}</strong></span><span><StatusBadge value="Visited" /> <strong>{rows.filter(row => row.status === "Visited").length}</strong></span></div>}<section className="panel"><div className="panel-heading"><div><p className="eyebrow">ROUTE RECONCILIATION</p><h2>Planned stops & actual visits</h2></div><span className="panel-count">{rows.length} records</span></div>{report.isLoading ? <LoadingBlock /> : report.isError ? <ErrorBlock onRetry={() => void report.refetch()} /> : <DataTable rows={rows} columns={columns} exportName="plan-vs-actual" emptyTitle="No planned stops in this range" emptyDescription="Create a weekly plan to start comparing planned and completed visits." />}</section></div>;
}

export function UpcomingPlanView() {
  const start = nextMondayDate();
  const end = useMemo(() => { const d = new Date(`${start}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); }, [start]);
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(end);
  const [employeeName, setEmployeeName] = useState("");
  const employees = trpc.fieldOps.employeeNames.useQuery();
  const query = trpc.fieldOps.reports.upcomingPlans.useQuery({ from, to, employeeName: employeeName || undefined });
  const rows = useMemo(() => (query.data ?? []).flatMap(plan => plan.items.map(item => ({ id: item.id, employeeName: plan.employeeName, weekStartingDate: plan.weekStartingDate, customerName: item.customerName, location: item.location, purpose: item.purpose, ticket: item.applyForTicket, travelMode: item.travelMode ?? "—", route: item.applyForTicket ? `${item.routeFrom ?? ""} → ${item.routeTo ?? ""}` : "—", preferredDate: item.preferredDate ?? "" }))), [query.data]);
  const columns = [
    { key: "weekStartingDate", label: "Week of", sortValue: (row: typeof rows[number]) => row.weekStartingDate, render: (row: typeof rows[number]) => dateLabel(row.weekStartingDate) },
    { key: "employeeName", label: "Employee", sortValue: (row: typeof rows[number]) => row.employeeName, render: (row: typeof rows[number]) => <strong className="table-primary-text">{row.employeeName}</strong> },
    { key: "customerName", label: "Planned customer", sortValue: (row: typeof rows[number]) => row.customerName, render: (row: typeof rows[number]) => row.customerName },
    { key: "location", label: "Location", sortValue: (row: typeof rows[number]) => row.location, render: (row: typeof rows[number]) => <span className="table-location"><MapPin size={13} />{row.location}</span> },
    { key: "purpose", label: "Purpose", sortValue: (row: typeof rows[number]) => row.purpose, render: (row: typeof rows[number]) => row.purpose },
    { key: "ticket", label: "Ticket", sortValue: (row: typeof rows[number]) => row.ticket ? "Requested" : "—", render: (row: typeof rows[number]) => row.ticket ? <StatusBadge value="Requested" /> : "—" },
    { key: "travelMode", label: "Travel mode", sortValue: (row: typeof rows[number]) => row.travelMode, render: (row: typeof rows[number]) => row.travelMode },
    { key: "route", label: "Route", sortValue: (row: typeof rows[number]) => row.route, render: (row: typeof rows[number]) => row.route },
    { key: "preferredDate", label: "Preferred date", sortValue: (row: typeof rows[number]) => row.preferredDate, render: (row: typeof rows[number]) => row.preferredDate ? dateLabel(row.preferredDate) : "—" },
  ];
  return <div className="view-stack"><div className="page-heading"><div><p className="eyebrow">FORWARD VIEW</p><h1>Upcoming plan.</h1><p className="page-subtitle">The team’s next route, all in one place.</p></div><div className="report-icon"><CalendarDays size={20} /></div></div><div className="report-filter-card"><DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} /><label className="filter-select"><span>Employee</span><select value={employeeName} onChange={event => setEmployeeName(event.target.value)}><option value="">All employees</option>{(employees.data ?? []).map(name => <option key={name}>{name}</option>)}</select></label></div><section className="panel"><div className="panel-heading"><div><p className="eyebrow">PLANNED STOPS</p><h2>Next week across the team</h2></div><span className="panel-count">{rows.length} stops</span></div>{query.isLoading ? <LoadingBlock /> : query.isError ? <ErrorBlock onRetry={() => void query.refetch()} /> : <DataTable rows={rows} columns={columns} exportName="upcoming-plan" emptyTitle="No upcoming plans yet" emptyDescription="Weekly plans submitted by the team will appear here." />}</section></div>;
}

export function ReportCostIcon() { return <ArrowDownRight size={15} />; }
