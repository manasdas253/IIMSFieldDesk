import { Activity, Bell, CalendarClock, ChevronLeft, ChevronRight, ClipboardCheck, Coins, Compass, FileBarChart2, LayoutDashboard, ListChecks, MapPinned, Plus, Route, Sparkles, Users, FileSpreadsheet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import VisitForms from "@/components/field-ops/VisitForms";
import { CostSummaryView, EmployeeReportView, OverviewView, PlanVsActualView, TodayVisitsView, UpcomingPlanView } from "@/components/field-ops/Reports";
import TotalVisitsToDateView from "@/components/field-ops/TotalVisitsToDateView";
import WeeklyVisitsView from "@/components/field-ops/WeeklyVisitsView";
import MonthlyPlanReportView from "@/components/field-ops/MonthlyPlanReport";
import EmployeesView from "@/components/field-ops/EmployeesView";
import MonthlyPlanWorkspace from "@/components/field-ops/MonthlyPlanWorkspace";
import FollowUpsView from "@/components/field-ops/FollowUpsView";
import ExecutiveTravelSummaryView from "@/components/field-ops/ExecutiveTravelSummary";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/CurrentUserContext";
import { UserMenu } from "@/components/AuthGate";

type View = "overview" | "log" | "plan" | "monthlyPlan" | "followUps" | "today" | "employee" | "cost" | "compare" | "upcoming" | "weeklyVisits" | "allVisits" | "monthlyReport" | "executiveTravel" | "employees";
const navigation: Array<{ id: View; label: string; shortLabel: string; icon: typeof LayoutDashboard; group: "workspace" | "insights" }> = [
  { id: "overview", label: "Overview", shortLabel: "Home", icon: LayoutDashboard, group: "workspace" },
  { id: "log", label: "Log a visit", shortLabel: "Log", icon: Plus, group: "workspace" },
  { id: "plan", label: "Weekly plan", shortLabel: "Plan", icon: CalendarClock, group: "workspace" },
  { id: "monthlyPlan", label: "Monthly plan", shortLabel: "Month plan", icon: FileSpreadsheet, group: "workspace" },
  { id: "employees", label: "Employee directory", shortLabel: "Team", icon: Users, group: "workspace" },
  { id: "followUps", label: "Follow-ups", shortLabel: "Follow-ups", icon: CalendarClock, group: "insights" },
  { id: "monthlyReport", label: "Monthly plan report", shortLabel: "Month", icon: FileSpreadsheet, group: "insights" },
  { id: "executiveTravel", label: "Executive Travel Summary", shortLabel: "Exec travel", icon: Route, group: "insights" },
  { id: "today", label: "Today’s visits", shortLabel: "Visits", icon: MapPinned, group: "insights" },
  { id: "employee", label: "Employee report", shortLabel: "People", icon: Users, group: "insights" },
  { id: "cost", label: "Cost summary", shortLabel: "Costs", icon: Coins, group: "insights" },
  { id: "compare", label: "Plan vs actual", shortLabel: "Compare", icon: ClipboardCheck, group: "insights" },
  { id: "upcoming", label: "Upcoming plan", shortLabel: "Upcoming", icon: Route, group: "insights" },
  { id: "weeklyVisits", label: "Weekly visits", shortLabel: "Weekly", icon: FileBarChart2, group: "insights" },
  { id: "allVisits", label: "All visits", shortLabel: "All visits", icon: ListChecks, group: "insights" },
];

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 42 42" fill="none"><path d="M10 31.5 20.8 10l10.8 21.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="10" cy="31.5" r="4" fill="currentColor"/><circle cx="20.8" cy="10" r="4" fill="currentColor"/><circle cx="31.6" cy="31.5" r="4" fill="currentColor"/><path d="M14 31.5h13.6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg></div>;
}

function Sidebar({ view, setView, items }: { view: View; setView: (value: View) => void; items: typeof navigation }) {
  const [collapsed, setCollapsed] = useState(false);
  const CollapseIcon = collapsed ? ChevronRight : ChevronLeft;

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="brand">
        <BrandMark />
        <div className="brand-copy">
          <img className="sidebar-iims-wordmark" src="/brand/iims-wordmark-compact.png" alt="IIMS logo" width={560} height={146} />
          <strong className="sidebar-product-label">FIELDDESK <span>/ Field operations</span></strong>
        </div>
        <button type="button" className="sidebar-toggle" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(current => !current)}>
          <CollapseIcon size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="workspace-chip">
        <div className="workspace-brand-lockup" role="group" aria-label="CKA Birla Group and IIMS">
          <img className="workspace-iims-compact-wordmark" src="/brand/iims-wordmark-compact.png" alt="IIMS logo" width={560} height={146} />
        </div>
        <div className="workspace-details"><span className="workspace-dot" /><div><strong>CKA BIRLA GROUP · IIMS</strong><small>Internal workspace</small></div><Sparkles size={15} /></div>
      </div>
      <div className="nav-group"><span className="nav-label">WORKSPACE</span>{items.filter(item => item.group === "workspace").map(item => <NavButton key={item.id} item={item} active={view === item.id} setView={setView} />)}</div>
      {items.some(item => item.group === "insights") && <div className="nav-group insight-group"><span className="nav-label">REPORTS & INSIGHTS</span>{items.filter(item => item.group === "insights").map(item => <NavButton key={item.id} item={item} active={view === item.id} setView={setView} />)}</div>}
      <div className="sidebar-bottom"><div className="sidebar-route"><div className="route-icon"><Compass size={17} /></div><div><strong>Keep the route clear.</strong><small>Every stop tells a story.</small></div></div><div className="sidebar-footer" title="Phase 1 · No sign-in required"><span className="online-dot" />Phase 1 · No sign-in required</div></div>
    </aside>
  );
}
function NavButton({ item, active, setView }: { item: (typeof navigation)[number]; active: boolean; setView: (value: View) => void }) {
  const Icon = item.icon;
  return <button type="button" className={`nav-item${active ? " active" : ""}`} aria-label={item.label} aria-current={active ? "page" : undefined} title={item.label} onClick={() => setView(item.id)}><Icon size={18} strokeWidth={active ? 2.3 : 1.8} /><span>{item.label}</span>{active && <i />}</button>;
}

export default function Home() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const employeeViews: View[] = ["log", "plan", "monthlyPlan"];
  const allowedNavigation = isAdmin ? navigation : navigation.filter(item => employeeViews.includes(item.id));
  const [view, setView] = useState<View>(isAdmin ? "overview" : "log");
  const setAllowedView = (next: View) => setView(isAdmin || employeeViews.includes(next) ? next : "log");
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [reminderEmpCode] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem("fielddesk:lastEmpCode") ?? "");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const next3 = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 3 * 86400000));
  const dueReminders = trpc.fieldOps.followUps.dueSummary.useQuery({}, { refetchInterval: 60_000, enabled: isAdmin });
  const upcomingReminders = trpc.fieldOps.followUps.list.useQuery({ status: "Pending", from: today, to: next3 }, { refetchInterval: 60_000, enabled: isAdmin });
  useEffect(() => { if (!isAdmin && !employeeViews.includes(view)) setView("log"); }, [isAdmin, view]);
  useEffect(() => { const openLog = () => setView("log"); window.addEventListener("fielddesk:open-followup-log", openLog); return () => window.removeEventListener("fielddesk:open-followup-log", openLog); }, []);
  useEffect(() => {
    if (!dueReminders.data?.length) return;
    const key = `fielddesk-open-reminder:${today}:${reminderEmpCode || "ALL"}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "shown");
    const overdue = dueReminders.data.filter(item => item.followUpDate < today).length;
    toast(`You have ${dueReminders.data.length} follow-up${dueReminders.data.length === 1 ? "" : "s"} due`, { description: overdue ? `${overdue} overdue · open the follow-up queue to review.` : "Due today · open the follow-up queue to review.", action: { label: "Open", onClick: () => setView("followUps") } });
  }, [dueReminders.data, today, reminderEmpCode]);
  const active = allowedNavigation.find(item => item.id === view);
  const selectedView = view === "followUps" ? <FollowUpsView /> : view === "monthlyPlan" ? <MonthlyPlanWorkspace /> : view === "employees" ? <EmployeesView /> : view === "executiveTravel" ? <ExecutiveTravelSummaryView /> : view === "monthlyReport" ? <MonthlyPlanReportView /> : view === "weeklyVisits" ? <WeeklyVisitsView /> : view === "allVisits" ? <TotalVisitsToDateView onBack={() => setView("overview")} /> : view === "log" || view === "plan" ? <VisitForms key={view} initialSection={view === "plan" ? "plan" : "visit"} /> : view === "today" ? <TodayVisitsView /> : view === "employee" ? <EmployeeReportView /> : view === "cost" ? <CostSummaryView /> : view === "compare" ? <PlanVsActualView /> : view === "upcoming" ? <UpcomingPlanView /> : <OverviewView onViewWeeklyPlan={() => setView("upcoming")} onViewAllVisits={() => setView("allVisits")} onViewFollowUps={() => setView("followUps")} />;
  const displayDate = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date());

  return <div className={`app-frame${isAdmin ? "" : " employee-shell"}`}><Sidebar view={view} setView={setAllowedView} items={allowedNavigation} /><div className="main-area"><header className="topbar"><div className="mobile-brand"><BrandMark /><strong>FIELD<span>DESK</span></strong><img className="mobile-iims-logo" src="/brand/cka-iims-wordmark.png" alt="CKA Birla Group and IIMS logos" width={641} height={149} /></div><div className="topbar-context"><span className="topbar-dot" /><span>CKA Birla Group <b>/</b> IIMS</span><span className="topbar-separator">·</span><span className="topbar-page">{active?.label ?? "Overview"}</span></div><div className="topbar-right"><div className="top-date"><Activity size={15} /><span>{displayDate}</span></div><div className="reminder-bell-wrap"><button type="button" className="reminder-bell" aria-label={`${dueReminders.data?.length ?? 0} follow-ups due`} aria-expanded={remindersOpen} onClick={() => setRemindersOpen(value => !value)}><Bell size={17} />{Boolean(dueReminders.data?.length) && <span>{dueReminders.data?.length}</span>}</button>{remindersOpen && <div className="reminder-panel"><div className="reminder-panel-head"><strong>Follow-up reminders</strong><span>{dueReminders.data?.length ?? 0} due now</span></div>{[...[{ label: "Overdue", rows: (dueReminders.data ?? []).filter(item => item.followUpDate < today) }, { label: "Today", rows: (dueReminders.data ?? []).filter(item => item.followUpDate === today) }, { label: "Next 3 days", rows: (upcomingReminders.data ?? []).filter(item => item.followUpDate > today) }]].map(group => group.rows.length > 0 && <div className="reminder-group" key={group.label}><b>{group.label}</b>{group.rows.slice(0, 3).map(item => <button key={item.id} type="button" onClick={() => { setRemindersOpen(false); setView("followUps"); }}><span>{item.customerName}</span><small>{item.empCode ?? "Unmapped"} · {item.followUpDate}</small></button>)}</div>)}<button type="button" className="reminder-open-all" onClick={() => { setRemindersOpen(false); setView("followUps"); }}>Open follow-up queue</button></div>}</div><button type="button" className="button button-primary top-cta" onClick={() => setAllowedView("log")}><Plus size={17} />Log a visit</button><UserMenu /></div></header><main className="main-content">{selectedView}</main><footer className="mobile-footer"><div className="mobile-nav">{allowedNavigation.map(item => { const Icon = item.icon; return <button key={item.id} type="button" className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><Icon size={18} /><span>{item.shortLabel}</span></button>; })}</div></footer></div></div>;
}
