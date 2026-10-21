import { useMemo } from "react";
import { CalendarDays, CircleDollarSign, ClipboardList, MapPin, Users } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { nextMondayDate } from "@shared/fieldOps";
import DataTable from "./DataTable";

type Outputs = inferRouterOutputs<AppRouter>;
type VisitRow = Outputs["fieldOps"]["visits"]["list"][number];
type CostSummaryRow = Outputs["fieldOps"]["reports"]["costSummary"][number];
type PlanRow = Outputs["fieldOps"]["plans"]["list"][number];

export type OverviewKpiKey = "visitsToday" | "activeField" | "monthlyCost" | "pendingPlans";

type Props = {
  kind: OverviewKpiKey | null;
  todayDate: string;
  kpiValue: string | number;
  visits: VisitRow[];
  visitsLoading: boolean;
  visitsError: boolean;
  onRetryVisits: () => void;
  onClose: () => void;
};

function dateLabel(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}

function formatINR(value: number | string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

const detailMeta = {
  visitsToday: {
    title: "Visits today",
    description: "The visit records behind today’s activity count.",
    icon: MapPin,
    tone: "orange",
  },
  activeField: {
    title: "Active in field",
    description: "Team members represented by a visit recorded today.",
    icon: Users,
    tone: "blue",
  },
  monthlyCost: {
    title: "Travel cost · MTD",
    description: "Month-to-date travel spend by employee, from the existing cost summary.",
    icon: CircleDollarSign,
    tone: "green",
  },
  pendingPlans: {
    title: "Pending plans",
    description: "Weekly plans beginning next Monday or later, matching the Overview count.",
    icon: ClipboardList,
    tone: "violet",
  },
} satisfies Record<OverviewKpiKey, { title: string; description: string; icon: typeof MapPin; tone: string }>;

const visitColumns = [
  { key: "visitDate", label: "Date", sortValue: (row: VisitRow) => row.visitDate, render: (row: VisitRow) => dateLabel(row.visitDate) },
  { key: "employeeName", label: "Employee", sortValue: (row: VisitRow) => row.employeeName, render: (row: VisitRow) => <strong className="table-primary-text">{row.employeeName}</strong> },
  { key: "customerName", label: "Customer", sortValue: (row: VisitRow) => row.customerName, render: (row: VisitRow) => row.customerName },
  { key: "location", label: "Location", sortValue: (row: VisitRow) => row.location, render: (row: VisitRow) => <span className="table-location"><MapPin size={13} />{row.location}</span> },
  { key: "purpose", label: "Purpose", sortValue: (row: VisitRow) => row.purpose, render: (row: VisitRow) => row.purpose },
  { key: "outcome", label: "Outcome", sortValue: (row: VisitRow) => row.outcome, render: (row: VisitRow) => row.outcome },
  { key: "travelCost", label: "Travel cost", sortValue: (row: VisitRow) => Number(row.travelCost), exportValue: (row: VisitRow) => Number(row.travelCost), render: (row: VisitRow) => <strong className="amount-cell">{formatINR(row.travelCost)}</strong> },
];

const costColumns = [
  { key: "employeeName", label: "Employee", sortValue: (row: CostSummaryRow) => row.employeeName, render: (row: CostSummaryRow) => <strong className="table-primary-text">{row.employeeName}</strong> },
  { key: "visitCount", label: "Visits", sortValue: (row: CostSummaryRow) => row.visitCount, render: (row: CostSummaryRow) => row.visitCount },
  { key: "totalCost", label: "Travel cost", sortValue: (row: CostSummaryRow) => row.totalCost, exportValue: (row: CostSummaryRow) => row.totalCost, render: (row: CostSummaryRow) => <strong className="amount-cell">{formatINR(row.totalCost)}</strong> },
  { key: "averageCost", label: "Average / visit", sortValue: (row: CostSummaryRow) => row.averageCost, exportValue: (row: CostSummaryRow) => Math.round(row.averageCost * 100) / 100, render: (row: CostSummaryRow) => formatINR(row.averageCost) },
];

function LoadingDetails() {
  return <div className="kpi-detail-loading" aria-label="Loading KPI details"><div /><div /><div /></div>;
}

function EmptyDetails({ title, description }: { title: string; description: string }) {
  return <div className="kpi-detail-empty"><div className="kpi-detail-empty-mark">—</div><strong>{title}</strong><p>{description}</p></div>;
}

function ErrorDetails({ onRetry }: { onRetry: () => void }) {
  return <div className="kpi-detail-error" role="alert"><strong>Couldn’t load these details.</strong><span>Check your connection and try again.</span><button type="button" className="button button-secondary button-small" onClick={onRetry}>Retry</button></div>;
}

function ActiveEmployeeDetails({ visits }: { visits: VisitRow[] }) {
  const employees = useMemo(() => {
    const grouped = new Map<string, VisitRow[]>();
    for (const visit of visits) grouped.set(visit.employeeName, [...(grouped.get(visit.employeeName) ?? []), visit]);
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right, "en"));
  }, [visits]);

  if (!employees.length) return <EmptyDetails title="No one is recorded in the field today" description="An employee appears here after a visit is logged for today." />;

  return <div className="kpi-detail-employee-list">{employees.map(([employeeName, employeeVisits]) => (
    <article className="kpi-detail-employee" key={employeeName}>
      <div className="kpi-detail-employee-heading"><div className="kpi-detail-avatar" aria-hidden="true">{employeeName.trim().slice(0, 1).toLocaleUpperCase()}</div><div><strong>{employeeName}</strong><span>{employeeVisits.length} {employeeVisits.length === 1 ? "visit" : "visits"} recorded today</span></div></div>
      <div className="kpi-detail-visit-list">{employeeVisits.map(visit => (
        <div className="kpi-detail-visit" key={visit.id}>
          <div><strong>{visit.customerName}</strong><span>{visit.location} <i>·</i> {visit.purpose}</span></div>
          <span className="kpi-detail-outcome">{visit.outcome || "Outcome not recorded"}</span>
        </div>
      ))}</div>
    </article>
  ))}</div>;
}

function PendingPlanDetails({ plans }: { plans: PlanRow[] }) {
  if (!plans.length) return <EmptyDetails title="No upcoming plans yet" description="Weekly plans starting next Monday or later will appear here." />;

  return <div className="kpi-detail-plan-list">{plans.map(plan => (
    <article className="kpi-detail-plan" key={plan.id}>
      <div className="kpi-detail-plan-heading"><div><strong>{plan.employeeName}</strong><span><CalendarDays size={13} /> Week of {dateLabel(plan.weekStartingDate)}</span></div><span className="kpi-detail-plan-count">{plan.items.length} {plan.items.length === 1 ? "planned stop" : "planned stops"}</span></div>
      {plan.items.length > 0 ? <div className="kpi-detail-plan-items">{plan.items.map(item => (
        <div className="kpi-detail-plan-item" key={item.id}>
          <div className="kpi-detail-plan-pin"><MapPin size={15} /></div>
          <div className="kpi-detail-plan-copy"><strong>{item.customerName}</strong><span>{item.location} <i>·</i> {item.purpose}</span>{item.applyForTicket && <small>Ticket requested{item.travelMode ? ` · ${item.travelMode}` : ""}{item.routeFrom || item.routeTo ? ` · ${item.routeFrom ?? "—"} → ${item.routeTo ?? "—"}` : ""}{item.preferredDate ? ` · ${dateLabel(item.preferredDate)}` : ""}</small>}</div>
        </div>
      ))}</div> : <p className="kpi-detail-plan-empty">No planned stops were added to this plan.</p>}
    </article>
  ))}</div>;
}

export default function OverviewKpiDetails({ kind, todayDate, kpiValue, visits, visitsLoading, visitsError, onRetryVisits, onClose }: Props) {
  const open = kind !== null;
  const monthStart = `${todayDate.slice(0, 7)}-01`;
  const nextMonday = nextMondayDate();
  const costQuery = trpc.fieldOps.reports.costSummary.useQuery({ from: monthStart, to: todayDate }, { enabled: open && kind === "monthlyCost" });
  const plansQuery = trpc.fieldOps.plans.list.useQuery({ from: nextMonday }, { enabled: open && kind === "pendingPlans" });

  if (!kind) return <Dialog open={false} onOpenChange={isOpen => { if (!isOpen) onClose(); }} />;

  const meta = detailMeta[kind];
  const Icon = meta.icon;
  const periodLabel = kind === "monthlyCost"
    ? new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(Number(todayDate.slice(0, 4)), Number(todayDate.slice(5, 7)) - 1, 1))
    : kind === "pendingPlans"
      ? `From ${dateLabel(nextMonday)}`
      : dateLabel(todayDate);

  return <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) onClose(); }}>
    <DialogContent className="overview-kpi-dialog">
      <header className="kpi-detail-header"><div className={`kpi-detail-icon ${meta.tone}`}><Icon size={19} /></div><div><p className="eyebrow">OVERVIEW DETAIL</p><DialogTitle>{meta.title}</DialogTitle><DialogDescription>{meta.description}</DialogDescription></div></header>
      <div className="kpi-detail-period"><span><CalendarDays size={14} />{periodLabel}</span><div><small>Current KPI</small><strong>{kpiValue}</strong></div></div>
      <div className="kpi-detail-body">
        {kind === "visitsToday" && (visitsLoading ? <LoadingDetails /> : visitsError ? <ErrorDetails onRetry={onRetryVisits} /> : <div className="kpi-detail-table"><DataTable rows={visits} columns={visitColumns} exportName="overview-visits-today" pageSize={6} emptyTitle="No visits logged today" emptyDescription="When field visits are logged, their details will appear here." /></div>)}
        {kind === "activeField" && (visitsLoading ? <LoadingDetails /> : visitsError ? <ErrorDetails onRetry={onRetryVisits} /> : <ActiveEmployeeDetails visits={visits} />)}
        {kind === "monthlyCost" && (costQuery.isLoading ? <LoadingDetails /> : costQuery.isError ? <ErrorDetails onRetry={() => void costQuery.refetch()} /> : <div className="kpi-detail-table"><DataTable rows={costQuery.data ?? []} columns={costColumns} exportName="overview-cost-mtd" pageSize={6} emptyTitle="No travel cost recorded this month" emptyDescription="Submitted visit logs with travel cost will appear here." /></div>)}
        {kind === "pendingPlans" && (plansQuery.isLoading ? <LoadingDetails /> : plansQuery.isError ? <ErrorDetails onRetry={() => void plansQuery.refetch()} /> : <PendingPlanDetails plans={plansQuery.data ?? []} />)}
      </div>
    </DialogContent>
  </Dialog>;
}
