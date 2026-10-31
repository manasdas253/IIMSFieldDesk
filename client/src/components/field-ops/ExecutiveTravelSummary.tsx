import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { Download, FileSpreadsheet, FileText, MapPin, Users, Building2, Route } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { DailyMapVisit } from "./indiaMapData";

const IndiaVisitsMap = lazy(() => import("./IndiaVisitsMap"));

type GroupMode = "date" | "location" | "department";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const displayDate = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

export default function ExecutiveTravelSummaryView() {
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<GroupMode>("date");
  const [location, setLocation] = useState("ALL");
  const [department, setDepartment] = useState("ALL");
  const [search, setSearch] = useState("");
  const month = date.slice(0, 7);
  const query = trpc.fieldOps.reports.executiveTravelSummary.useQuery({ month }, { enabled: /^\d{4}-\d{2}$/.test(month) });
  const completedVisitsQuery = trpc.fieldOps.reports.executiveCompletedVisits.useQuery({ date }, { enabled: /^\d{4}-\d{2}-\d{2}$/.test(date) });
  const [selectedCityKey, setSelectedCityKey] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const onCitySelect = useCallback((cityKey: string) => { setSelectedCityKey(cityKey); setFocusRequest(value => value + 1); }, []);
  useEffect(() => { setSelectedCityKey(null); }, [date]);
  const actualMapVisits = useMemo<DailyMapVisit[]>(() => (completedVisitsQuery.data ?? []).map(visit => ({ id: visit.id, employeeName: visit.employeeName, customerName: visit.customerName, location: visit.location, purpose: visit.purpose, outcome: visit.outcome ?? "Completed", createdAt: visit.createdAt, visitDate: visit.visitDate, notes: visit.notes, visitStatus: "Visited" })), [completedVisitsQuery.data]);
  const rows = query.data ?? [];
  const locations = useMemo(() => [...new Set(rows.map(row => row.location).filter(Boolean))].sort(), [rows]);
  const departments = useMemo(() => [...new Set(rows.map(row => row.department).filter(Boolean))].sort(), [rows]);
  const filtered = useMemo(() => rows.filter(row => (location === "ALL" || row.location === location) && (department === "ALL" || row.department === department) && (!search || [row.employeeName, row.empCode, row.department, row.customerName, row.location, row.purpose, row.remarks].some(value => value.toLocaleLowerCase().includes(search.toLocaleLowerCase())))), [rows, location, department, search]);
  const dayRows = filtered.filter(row => row.plannedDate === date);
  const plannedMapVisits = useMemo<DailyMapVisit[]>(() => dayRows.filter(plan => !actualMapVisits.some(visit => visit.employeeName.trim().toLocaleLowerCase("en-IN") === plan.employeeName.trim().toLocaleLowerCase("en-IN") && visit.customerName.trim().toLocaleLowerCase("en-IN") === plan.customerName.trim().toLocaleLowerCase("en-IN"))).map((plan, index) => ({ id: -Math.abs(typeof plan.id === "number" ? plan.id : index + 1), employeeName: plan.employeeName, customerName: plan.customerName, location: plan.location, purpose: plan.purpose, outcome: "No completed visit recorded", createdAt: new Date(`${plan.plannedDate}T00:00:00Z`), visitDate: plan.plannedDate, notes: plan.remarks || null, visitStatus: "travelStatus" in plan && plan.travelStatus === "Rescheduled" ? "Rescheduled" : "Planned" })), [dayRows, actualMapVisits]);
  const mapVisits = useMemo(() => [...actualMapVisits, ...plannedMapVisits], [actualMapVisits, plannedMapVisits]);
  const plannedMapVisitCount = plannedMapVisits.length;
  const groupRows = dayRows;
  const keyFor = (row: typeof rows[number]) => mode === "date" ? row.plannedDate : mode === "location" ? row.location : row.department || "Unassigned";
  const groups = useMemo(() => Object.entries(groupRows.reduce<Record<string, typeof groupRows>>((acc, row) => { const key = keyFor(row); (acc[key] ??= []).push(row); return acc; }, {})).sort(([a], [b]) => a.localeCompare(b)), [groupRows, mode]);
  const exportExcel = async () => {
    const exportRows = dayRows;
    if (!exportRows.length) return;
    const workbook = new ExcelJS.Workbook(); workbook.creator = "FieldDesk · IIMS"; workbook.title = `Executive Travel Summary ${month}`;
    const sheet = workbook.addWorksheet("Planned Travel");
    sheet.mergeCells("A1:J1"); sheet.getCell("A1").value = "IIMS  |  EXECUTIVE TRAVEL SUMMARY"; sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } }; sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC8102E" } }; sheet.addRow([`PLANNED AND RESCHEDULED TRAVEL · ${displayDate(date)} · Current submitted monthly plan versions`]);
    sheet.addRow(["Travel Date", "Employee Name", "Emp Code", "Business Vertical", "Customer", "Location", "Visit Purpose", "Remarks", "Travel Status", "Plan Version"]);
    for (const row of exportRows) sheet.addRow([row.plannedDate, row.employeeName, row.empCode, row.department || "Unassigned", row.customerName, row.location, row.purpose, row.remarks, "travelStatus" in row ? row.travelStatus : "Planned", `v${row.version}`]);
    sheet.columns = [14, 26, 15, 22, 28, 22, 20, 32, 18, 14].map(width => ({ width }));
    sheet.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF29272D" } }; sheet.autoFilter = { from: "A3", to: `J${Math.max(3, sheet.rowCount)}` }; sheet.views = [{ state: "frozen", ySplit: 3 }];
    const buffer = await workbook.xlsx.writeBuffer(); const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })); const a = document.createElement("a"); a.href = url; a.download = `IIMS_Executive_Travel_Summary_${month}.xlsx`; a.click(); URL.revokeObjectURL(url); toast.success("Excel report downloaded");
  };
  return <div className="view-stack executive-travel">
    <div className="page-heading"><div><p className="eyebrow">MANAGEMENT REPORT · PLANNED TRAVEL</p><h1>Executive Travel Summary.</h1><p className="page-subtitle">Submitted monthly plans · Current version per employee · {month}</p></div><div className="executive-actions"><button className="button button-secondary" onClick={() => void exportExcel()} disabled={!filtered.length}><FileSpreadsheet size={16}/>Export Excel</button><button className="button button-primary" onClick={() => window.print()}><FileText size={16}/>Export PDF</button></div></div>
    <div className="executive-notice"><Route size={16}/><span><b>Planned travel and rescheduled stops.</b> Rescheduled visits appear on the new date with the employee and destination details.</span></div>
    <section className="panel executive-filters"><label className="filter-select"><span>Travel date</span><input type="date" value={date} onChange={event => setDate(event.target.value)}/></label><label className="filter-select"><span>Location</span><select value={location} onChange={event => setLocation(event.target.value)}><option value="ALL">All locations</option>{locations.map(value => <option key={value}>{value}</option>)}</select></label><label className="filter-select"><span>Business Vertical</span><select value={department} onChange={event => setDepartment(event.target.value)}><option value="ALL">All business verticals</option>{departments.map(value => <option key={value}>{value}</option>)}</select></label><label className="filter-select"><span>Search</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Employee, customer, purpose…"/></label></section>
    <section className="executive-kpis"><article><span><Users size={17}/>Travelling on {displayDate(date)}</span><strong>{new Set(dayRows.map(row => row.empCode)).size}</strong><small>employees · planned</small></article><article><span><MapPin size={17}/>Unique locations</span><strong>{new Set(dayRows.map(row => row.location)).size}</strong><small>for selected date</small></article><article><span><Building2 size={17}/>Business Verticals</span><strong>{new Set(dayRows.map(row => row.department).filter(Boolean)).size}</strong><small>represented on selected date</small></article><article><span><Route size={17}/>Planned visits</span><strong>{dayRows.length}</strong><small>from submitted plans</small></article></section>
    <section className="panel"><div className="panel-heading executive-report-heading"><div><p className="eyebrow">SELECTED DATE</p><h2>{mode === "date" ? `Planned travel · ${displayDate(date)}` : `${mode === "location" ? "Location" : "Business Vertical"}-wise · ${displayDate(date)}`}</h2></div><div className="executive-tabs">{(["date", "location", "department"] as GroupMode[]).map(value => <button key={value} className={mode === value ? "active" : ""} onClick={() => setMode(value)}>{value === "department" ? "Business Vertical" : value[0].toUpperCase()+value.slice(1)}-wise</button>)}</div></div>
      {query.isLoading ? <p className="page-subtitle">Loading submitted plans…</p> : query.isError ? <p className="error-block">Could not load the travel summary. Check the connection and retry.</p> : !groups.length ? <div className="empty-state"><strong>No submitted planned travel found for {displayDate(date)}</strong><p>Try another date or adjust the filters.</p></div> : <div className="table-scroll executive-table"><table className="data-table"><thead><tr><th>{mode === "date" ? "Travel date" : mode === "location" ? "Location" : "Business Vertical"}</th><th>Employee</th><th>Emp Code</th><th>Business Vertical</th><th>Customer</th><th>Location</th><th>Remarks / Purpose</th><th>Travel status</th></tr></thead><tbody>{groups.flatMap(([group, members]) => members.map((row, index) => <tr key={row.id}><td>{index === 0 ? mode === "date" ? displayDate(group) : group : ""}</td><td>{row.employeeName}</td><td>{row.empCode}</td><td>{row.department || "—"}</td><td>{row.customerName}</td><td>{row.location}</td><td>{row.remarks ? `${row.remarks} · ${row.purpose}` : row.purpose}</td><td><span className="planned-badge">{"travelStatus" in row ? row.travelStatus : "Planned"} · v{row.version}</span></td></tr>))}</tbody></table></div>}
    </section>
    <section className="panel india-map-panel executive-actual-map" aria-label="Completed customer visits on the India map">
      <div className="panel-heading"><div><p className="eyebrow">VISITS & SUBMITTED PLANS</p><h2>Customer locations across India</h2><p className="page-subtitle">Selected date: {displayDate(date)}. Amber markers are planned; colored markers include completed visits.</p></div><span className="panel-count">{actualMapVisits.length} completed · {plannedMapVisitCount} planned</span></div>
      {completedVisitsQuery.isLoading ? <div className="india-map-loading" aria-label="Loading visits map"><div className="skeleton skeleton-row"/><div className="skeleton skeleton-row"/><div className="skeleton skeleton-row"/></div> : completedVisitsQuery.isError ? <p className="error-block">Could not load visit details for the map.</p> : !mapVisits.length ? <div className="empty-state india-map-empty"><div className="empty-mark">-</div><strong>No completed visits or submitted plans found for {displayDate(date)}</strong><p>Locations appear here when employees submit a plan or record a completed visit.</p></div> : <Suspense fallback={<div className="india-map-loading" aria-label="Loading India map"><div className="skeleton skeleton-row"/></div>}><IndiaVisitsMap visits={mapVisits} selectedCityKey={selectedCityKey} focusRequest={focusRequest} onCitySelect={onCitySelect} onUnavailable={() => undefined}/></Suspense>}
    </section>
    <div className="executive-print-brand"><img src="/brand/cka-iims-wordmark.png" alt="CKA Birla Group and IIMS"/><span>Executive Travel Summary · Planned travel · {month}</span></div>
  </div>;
}
