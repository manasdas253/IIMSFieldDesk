import ExcelJS from "exceljs";
import { useState, type FormEvent } from "react";
import { AlertTriangle, CalendarDays, Download, FileSpreadsheet, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { VISIT_PURPOSES } from "@shared/fieldOps";

type UploadRow = { rowNumber: number; fields: Record<string, unknown> };
const dateIso = (value: unknown): string => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
  if (typeof value === "number" && Number.isFinite(value)) { const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000); return dateIso(date); }
  const text = String(value ?? "").trim();
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : text;
};
const text = (value: ExcelJS.CellValue | null | undefined): string => {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "text" in value) return String((value as { text?: string }).text ?? "");
  return value === null || value === undefined ? "" : String(value);
};
const monthNow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(new Date());

export default function MonthlyPlanWorkspace() {
  const user = useCurrentUser();
  return user?.role === "employee" ? <EmployeeMonthlyPlan /> : <AdminMonthlyPlanWorkspace />;
}

function EmployeeMonthlyPlan() {
  const user = useCurrentUser();
  const [month, setMonth] = useState(monthNow);
  const [plannedDate, setPlannedDate] = useState(`${month}-01`);
  const [customerName, setCustomerName] = useState("");
  const [location, setLocation] = useState("");
  const [purpose, setPurpose] = useState<(typeof VISIT_PURPOSES)[number]>("Follow-up");
  const [remarks, setRemarks] = useState("");
  const utils = trpc.useUtils();
  const profile = trpc.fieldOps.employees.list.useQuery({ includeInactive: false });
  const plan = trpc.fieldOps.monthlyPlans.list.useQuery({ month, empCode: user?.empCode });
  const holidays = trpc.fieldOps.holidays.list.useQuery({ from: `${month}-01`, to: `${month}-31` });
  const submit = trpc.fieldOps.monthlyPlans.submit.useMutation({ onSuccess: async () => { setCustomerName(""); setLocation(""); setRemarks(""); await utils.invalidate(); toast.success("Monthly plan updated"); }, onError: error => toast.error(error.message) });
  const addStop = (event: FormEvent) => {
    event.preventDefault();
    const current = plan.data?.[0]?.planItems ?? [];
    submit.mutate({ empCode: user!.empCode, planMonth: month, items: [...current.map(row => ({ plannedDate: row.plannedDate, customerName: row.customerName, location: row.location, purpose: row.purpose, applyForTicket: row.applyForTicket, travelMode: row.travelMode, routeFrom: row.routeFrom, routeTo: row.routeTo, preferredDate: row.preferredDate, remarks: row.remarks ?? "" })), { plannedDate, customerName, location, purpose, applyForTicket: false, remarks }] });
  };
  const mine = profile.data?.[0];
  const items = plan.data?.[0]?.planItems ?? [];
  return <div className="view-stack"><div className="page-heading"><div><p className="eyebrow">WORKSPACE · PLANNING</p><h1>Monthly plan.</h1><p className="page-subtitle">Build your customer route for the month.</p></div><div className="report-icon"><CalendarDays size={20} /></div></div><div className="report-filter-card"><label className="filter-select"><span>Plan month</span><input type="month" value={month} onChange={event => { setMonth(event.target.value); setPlannedDate(`${event.target.value}-01`); }} /></label></div>{mine && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">MY EMPLOYEE RECORD</p><h2>{mine.employeeName}</h2></div><span className="status-pill">{mine.empCode}</span></div><div className="report-summary-row"><div className="summary-tile"><span>DESIGNATION</span><strong>{mine.designation || "—"}</strong></div><div className="summary-tile"><span>DEPARTMENT</span><strong>{mine.department || "—"}</strong></div><div className="summary-tile"><span>CONTACT</span><strong>{mine.mobile || "—"}</strong></div></div></section>}<section className="panel"><div className="panel-heading"><div><p className="eyebrow">MONTHLY ROUTE</p><h2>{items.length} planned {items.length === 1 ? "stop" : "stops"}</h2></div></div>{items.length ? <div className="planned-items">{items.map((item, index) => <article className="planned-item" key={`${item.plannedDate}-${item.id}`}><div className="planned-item-top"><span className="item-index">{String(index + 1).padStart(2, "0")}</span><span className="item-caption">{item.plannedDate}</span></div><strong>{item.customerName}</strong><p>{item.location} · {item.purpose}</p>{item.remarks && <small>{item.remarks}</small>}</article>)}</div> : <p className="page-subtitle">No customer stops have been added for this month yet.</p>}<form className="form-grid monthly-employee-form" onSubmit={addStop}><label className="form-field"><span className="field-label">Planned date</span><input className="field-input" type="date" min={`${month}-01`} max={`${month}-31`} value={plannedDate} onChange={event => setPlannedDate(event.target.value)} required /></label><label className="form-field"><span className="field-label">Customer</span><input className="field-input" value={customerName} onChange={event => setCustomerName(event.target.value)} required /></label><label className="form-field"><span className="field-label">Location</span><input className="field-input" value={location} onChange={event => setLocation(event.target.value)} required /></label><label className="form-field"><span className="field-label">Purpose</span><select className="field-input" value={purpose} onChange={event => setPurpose(event.target.value as (typeof VISIT_PURPOSES)[number])}>{VISIT_PURPOSES.map(value => <option key={value}>{value}</option>)}</select></label><label className="form-field field-span-2"><span className="field-label">Notes</span><input className="field-input" value={remarks} onChange={event => setRemarks(event.target.value)} /></label><div className="field-span-2"><button className="button button-primary" disabled={submit.isPending}><Plus size={16} />Add planned stop</button></div></form></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">HOLIDAY CALENDAR</p><h2>Configured holidays</h2></div></div>{holidays.data?.length ? holidays.data.map(day => <div className="holiday-row" key={day.id}><CalendarDays size={15} /><strong>{day.name}</strong><span>{day.holidayDate}</span></div>) : <p className="page-subtitle">No holidays are configured for this month.</p>}</section></div>;
}

function AdminMonthlyPlanWorkspace() {
  const [month, setMonth] = useState(monthNow);
  const [empCode, setEmpCode] = useState("");
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [busyDownload, setBusyDownload] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const employees = trpc.fieldOps.employees.list.useQuery({ includeInactive: false });
  const utils = trpc.useUtils();
  const validateUpload = trpc.fieldOps.monthlyPlans.validateUpload.useMutation();
  const validation = validateUpload.data;

  const downloadTemplate = async () => {
    if (!empCode || busyDownload) return;
    setBusyDownload(true);
    try {
      const params = new URLSearchParams({ month, empCode });
      const response = await fetch(`/api/exports/monthly-plan-template.xlsx?${params}`);
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || "Couldn’t generate the template."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `Monthly_Plan_Input_${month}_${empCode}.xlsx`; anchor.click(); URL.revokeObjectURL(url); toast.success("Monthly plan template downloaded");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Template download failed."); }
    finally { setBusyDownload(false); }
  };

  const readWorkbook = async (file: File) => {
    setFileName(file.name); setRows([]); validateUpload.reset();
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const parsed: UploadRow[] = [];
      workbook.worksheets.forEach(sheet => {
        if (text(sheet.getCell("A5").value) !== "Emp Code") return;
        for (let rowNumber = 6; rowNumber <= sheet.rowCount; rowNumber++) {
          const row = sheet.getRow(rowNumber);
          const fields = {
            empCode: text(row.getCell(1).value).trim().toUpperCase(),
            employeeName: text(row.getCell(2).value).trim(),
            planMonth: text(row.getCell(3).value).trim(),
            plannedDate: dateIso(row.getCell(4).value),
            customerName: text(row.getCell(5).value).trim(),
            location: text(row.getCell(6).value).trim(),
            purpose: text(row.getCell(7).value).trim(),
            applyForTicket: text(row.getCell(8).value).trim(),
            travelMode: text(row.getCell(9).value).trim(),
            routeFrom: text(row.getCell(10).value).trim(),
            routeTo: text(row.getCell(11).value).trim(),
            preferredDate: dateIso(row.getCell(12).value),
            remarks: text(row.getCell(13).value).trim(),
          };
          const hasUserData = [fields.plannedDate, fields.customerName, fields.location, fields.purpose, fields.travelMode, fields.routeFrom, fields.routeTo, fields.preferredDate, fields.remarks].some(Boolean) || String(fields.applyForTicket).toLowerCase() === "yes";
          if (hasUserData) parsed.push({ rowNumber, fields });
        }
      });
      if (!parsed.length) throw new Error("No filled plan rows were found. Use the FieldDesk monthly input template.");
      setRows(parsed);
      toast.success(`${parsed.length} filled row${parsed.length === 1 ? "" : "s"} read from ${file.name}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn’t read this workbook."); }
  };

  const checkRows = async () => {
    if (!rows.length) return;
    try { await validateUpload.mutateAsync({ month, rows }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Upload validation failed."); }
  };
  const downloadErrorReport = async () => {
    if (!validation?.errors.length) return;
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Upload errors");
    const columns = ["Workbook row", "Emp Code", "Employee Name", "Plan Month", "Planned Date", "Customer Name", "Location / City", "Purpose", "Apply for Ticket", "Travel Mode", "From", "To", "Preferred Travel Date", "Remarks", "Error"];
    sheet.addRow(columns).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9B0A22" } };
    [...new Set(validation.errors.map(error => error.rowNumber))].forEach(rowNumber => {
      const source = rows.find(row => row.rowNumber === rowNumber);
      const fields = source?.fields ?? {};
      const message = validation.errors.filter(candidate => candidate.rowNumber === rowNumber).map(candidate => `${candidate.field}: ${candidate.message}`).join("; ");
      sheet.addRow([rowNumber, fields.empCode, fields.employeeName, fields.planMonth, fields.plannedDate, fields.customerName, fields.location, fields.purpose, fields.applyForTicket, fields.travelMode, fields.routeFrom, fields.routeTo, fields.preferredDate, fields.remarks, message]);
    });
    sheet.columns.forEach((column, index) => { column.width = index === 14 ? 55 : index === 5 || index === 13 ? 25 : 17; });
    const buffer = await workbook.xlsx.writeBuffer(); const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `Monthly_Plan_${month}_ERRORS.xlsx`; anchor.click(); URL.revokeObjectURL(url);
  };
  const submitValid = async () => {
    if (!validation?.validRows.length || validation.errors.length) return;
    setSubmitting(true);
    try {
      const grouped = new Map<string, typeof validation.validRows>();
      validation.validRows.forEach(row => grouped.set(row.empCode, [...(grouped.get(row.empCode) ?? []), row]));
      const currentPlans = await utils.client.fieldOps.monthlyPlans.list.query({ month });
      const replacing = [...grouped.keys()].filter(code => currentPlans.some(plan => plan.empCode === code));
      if (replacing.length && !window.confirm(`A plan already exists for ${replacing.join(", ")} in ${month}. Submitting will replace each existing plan and increment its version. Continue?`)) return;
      for (const [code, items] of grouped) await utils.client.fieldOps.monthlyPlans.submit.mutate({ empCode: code, planMonth: month, items: items.map(row => row.item) });
      await utils.invalidate(); toast.success(`Submitted monthly plan${grouped.size === 1 ? "" : "s"} for ${grouped.size} employee${grouped.size === 1 ? "" : "s"}.`); setRows([]); setFileName(""); validateUpload.reset();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not submit these plans. Any earlier employee sheets may already have been saved."); }
    finally { setSubmitting(false); }
  };

  return <div className="view-stack monthly-plan-workspace">
    <div className="page-heading"><div><p className="eyebrow">WORKSPACE · MONTHLY PLANNING</p><h1>Monthly plan workspace.</h1><p className="page-subtitle">Download an employee template, fill planned visits and upload for row-by-row validation.</p></div><div className="report-icon"><FileSpreadsheet size={20} /></div></div>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">STEP 1 · TEMPLATE</p><h2>Choose the planning month</h2></div></div><div className="plan-sheet-controls"><label className="filter-select"><span>Month</span><input type="month" value={month} onChange={event => { setMonth(event.target.value); setRows([]); validateUpload.reset(); }} /></label><label className="filter-select"><span>Employee / group</span><select value={empCode} onChange={event => setEmpCode(event.target.value)}><option value="">Choose an employee…</option><option value="ALL">All active employees</option>{(employees.data ?? []).map(employee => <option key={employee.empCode} value={employee.empCode}>{employee.empCode} · {employee.employeeName}</option>)}</select></label></div><div className="plan-sheet-downloads"><button className="button button-primary" disabled={!empCode || busyDownload} onClick={() => void downloadTemplate()}><Download size={16} />{busyDownload ? "Preparing…" : "Download Excel template"}</button></div><p className="page-subtitle">The template has one sheet per selected employee and 50 rows per sheet. Keep the Emp Code and Employee Name columns unchanged; fill one planned visit per row.</p></section>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">STEP 2 · UPLOAD</p><h2>Check a completed workbook</h2></div><span className="panel-chip"><Upload size={14} /> XLSX</span></div><label className="upload-drop"><Upload size={20} /><span><strong>{fileName || "Choose a completed FieldDesk template"}</strong><small>Only .xlsx files · your data is previewed before submission</small></span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event => { const file = event.target.files?.[0]; if (file) void readWorkbook(file); event.currentTarget.value = ""; }} /></label>{rows.length > 0 && <div className="plan-sheet-downloads"><button className="button button-secondary" disabled={validateUpload.isPending} onClick={() => void checkRows()}>{validateUpload.isPending ? "Validating…" : "Validate rows"}</button><span className="panel-count">{rows.length} rows found</span></div>}
      {validation && <div className="upload-validation"><div className={`upload-validation-summary ${validation.errors.length ? "has-errors" : "all-valid"}`}><strong>{validation.validCount} valid of {validation.totalRows} rows</strong><span>{validation.errors.length ? `${validation.errors.length} issue${validation.errors.length === 1 ? "" : "s"} need correction.` : "All rows are ready to submit."}</span></div>{validation.errors.length > 0 && <div className="upload-row-errors"><h3><AlertTriangle size={15} /> Fix the highlighted workbook rows and validate again</h3>{validation.errors.map((error, index) => <p key={`${error.rowNumber}-${error.field}-${index}`}><b>Row {error.rowNumber} · {error.field}</b> {error.message}</p>)}<button className="button button-secondary button-small" onClick={() => void downloadErrorReport()}>Download error report</button></div>}{validation.validRows.length > 0 && <div className="table-scroll"><table className="data-table"><thead><tr><th>Row</th><th>Emp Code</th><th>Planned date</th><th>Customer</th><th>Location</th><th>Purpose</th><th>Ticket</th></tr></thead><tbody>{validation.validRows.slice(0, 20).map(row => <tr key={`${row.rowNumber}-${row.empCode}`}><td>{row.rowNumber}</td><td>{row.empCode}</td><td>{row.item.plannedDate}</td><td>{row.item.customerName}</td><td>{row.item.location}</td><td>{row.item.purpose}</td><td>{row.item.applyForTicket ? "Yes" : "No"}</td></tr>)}</tbody></table></div>}{validation.errors.length === 0 && validation.validRows.length > 0 && <div className="plan-sheet-downloads"><button className="button button-primary" disabled={submitting} onClick={() => void submitValid()}>{submitting ? "Submitting…" : `Submit ${validation.validCount} valid row${validation.validCount === 1 ? "" : "s"}`}</button></div>}</div>}
    </section>
  </div>;
}
