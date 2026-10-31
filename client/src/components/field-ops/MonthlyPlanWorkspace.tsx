import ExcelJS from "exceljs";
import { useMemo, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, Pencil, Save, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { VISIT_PURPOSES, type VisitPurpose } from "../../../../shared/fieldOps";

type UploadRow = { rowNumber: number; fields: Record<string, unknown> };
type TemplateMetadata = { templateType: "change"; downloadedOn: string; basePlanVersion: number } | null;
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
const readPlanFields = (sheet: ExcelJS.Worksheet, row: ExcelJS.Row, selectedMonth: string) => {
  const headers = new Map<string, number>();
  sheet.getRow(5).eachCell((cell, column) => headers.set(text(cell.value).trim(), column));
  const get = (name: string, legacyColumn: number) => row.getCell(headers.get(name) ?? legacyColumn).value;
  return {
    empCode: text(get("Emp Code", 1)).trim().toUpperCase(), employeeName: text(get("Employee Name", 2)).trim(), planMonth: headers.has("Plan Month") ? text(get("Plan Month", 3)).trim() : selectedMonth,
    plannedDate: dateIso(get(headers.has("Plan Date") ? "Plan Date" : "Planned Date", headers.has("Plan Date") ? 3 : 4)),
    customerName: text(get("Customer Name", 5)).trim(), location: text(get("Location / City", 6)).trim(),
    purpose: text(get("Purpose", 7)).trim(), applyForTicket: text(get("Apply for Ticket", 8)).trim(), travelMode: text(get("Travel Mode", 9)).trim(),
    routeFrom: text(get("From", 10)).trim(), routeTo: text(get("To", 11)).trim(), preferredDate: dateIso(get("Preferred Travel Date", 12)), remarks: text(get("Remarks", 13)).trim(),
  };
};
const monthNow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(new Date());
const indiaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
type DayEdit = { date: string; type: "Customer Visit" | "No Visit" | "Office" | "Leave"; customerName: string; location: string; purpose: VisitPurpose; remarks: string };

export default function MonthlyPlanWorkspace() {
  const user = useCurrentUser();
  return user?.role === "employee" ? <EmployeeMonthlyPlan /> : <AdminMonthlyPlanWorkspace />;
}

function EmployeeMonthlyPlan() {
  const user = useCurrentUser();
  const todayIndia = indiaToday();
  const [month, setMonth] = useState(monthNow);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [templateMetadata, setTemplateMetadata] = useState<TemplateMetadata>(null);
  const [dayEdits, setDayEdits] = useState<DayEdit[]>([]);
  const [dayEditErrors, setDayEditErrors] = useState<Record<string, string>>({});
  const [busyDownload, setBusyDownload] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const utils = trpc.useUtils();
  const plan = trpc.fieldOps.monthlyPlans.list.useQuery({ month });
  const changeInfo = trpc.fieldOps.monthlyPlans.changeInfo.useQuery({ month });
  const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const holidays = trpc.fieldOps.holidays.list.useQuery({ from: `${month}-01`, to: monthEnd });
  const currentPlan = plan.data?.find(row => row.empCode === user?.empCode);
  const changeMode = currentPlan?.status === "Submitted";
  const monthOver = month < monthNow;
  const monthDays = useMemo(() => Array.from({ length: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate() }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`), [month]);
  const validateUpload = trpc.fieldOps.monthlyPlans.validateUpload.useMutation();
  const validation = validateUpload.data;
  const submit = trpc.fieldOps.monthlyPlans.submit.useMutation({ onSuccess: async () => { await utils.invalidate(); setRows([]); setFileName(""); validateUpload.reset(); toast.success("Your monthly plan was submitted"); }, onError: error => toast.error(error.message) });
  const editDaysMutation = trpc.fieldOps.monthlyPlans.editDays.useMutation({ onSuccess: async () => { await utils.invalidate(); setDayEdits([]); setDayEditErrors({}); toast.success("Your monthly plan was updated"); }, onError: error => toast.error(error.message) });
  const createDayEdit = (day: string): DayEdit => {
    const item = currentPlan?.planItems.find(entry => entry.plannedDate === day);
    const type = item && ["No Visit", "Office", "Leave"].includes(item.customerName) ? item.customerName as DayEdit["type"] : "Customer Visit";
    return { date: day, type, customerName: type === "Customer Visit" ? item?.customerName ?? "" : "", location: type === "Customer Visit" ? item?.location ?? "" : "", purpose: item?.purpose ?? "New Lead", remarks: item?.remarks ?? "" };
  };
  const updateDayEdit = (index: number, key: keyof DayEdit, value: string) => {
    setDayEdits(current => current.map((edit, row) => row === index ? { ...edit, [key]: value } : edit));
    setDayEditErrors(current => { const next = { ...current }; delete next[`${index}.${key}`]; return next; });
  };
  const saveDayEdits = () => {
    const errors: Record<string, string> = {};
    dayEdits.forEach((edit, index) => {
      if (edit.type !== "Customer Visit") return;
      if (!edit.customerName.trim()) errors[`${index}.customerName`] = "Enter a customer name.";
      if (!edit.location.trim()) errors[`${index}.location`] = "Enter a location or city.";
      if (!edit.purpose.trim()) errors[`${index}.purpose`] = "Choose a purpose.";
    });
    setDayEditErrors(errors);
    if (Object.keys(errors).length) return;
    editDaysMutation.mutate({ month, edits: dayEdits });
  };
  const downloadTemplate = async () => {
    if (!user?.empCode || busyDownload) return;
    setBusyDownload(true);
    try {
      const params = new URLSearchParams({ month, empCode: user.empCode, ...(changeMode ? { mode: "change" } : {}) });
      const response = await fetch(`/api/exports/monthly-plan-template.xlsx?${params}`);
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || "Couldn?t generate the template."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `Monthly_Plan_Input_${month}_${user.empCode}.xlsx`; anchor.click(); URL.revokeObjectURL(url); toast.success("Your monthly plan template was downloaded");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Template download failed."); }
    finally { setBusyDownload(false); }
  };
  const readWorkbook = async (file: File) => {
    setFileName(file.name); setRows([]); setTemplateMetadata(null); validateUpload.reset();
    try {
      const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await file.arrayBuffer());
      const metadataSheet = workbook.getWorksheet("_FieldDeskMetadata");
      const templateType = text(metadataSheet?.getCell("B1").value).trim();
      const downloadedOn = text(metadataSheet?.getCell("B2").value).trim();
      const basePlanVersion = Number(text(metadataSheet?.getCell("B3").value));
      setTemplateMetadata(templateType === "change" && downloadedOn && Number.isInteger(basePlanVersion) ? { templateType: "change", downloadedOn, basePlanVersion } : null);
      const parsed: UploadRow[] = [];
      workbook.worksheets.forEach(sheet => {
        if (text(sheet.getCell("A5").value) !== "Emp Code") return;
        const sheetStart = parsed.length;
        for (let rowNumber = 6; rowNumber <= sheet.rowCount; rowNumber++) {
          const row = sheet.getRow(rowNumber);
          const fields = readPlanFields(sheet, row, month);
          const hasData = [fields.plannedDate, fields.customerName, fields.location, fields.purpose, fields.travelMode, fields.routeFrom, fields.routeTo, fields.preferredDate, fields.remarks].some(Boolean) || fields.applyForTicket.toLowerCase() === "yes";
          if (hasData) parsed.push({ rowNumber, fields });
        }
        if (parsed.length === sheetStart) parsed.push({ rowNumber: 6, fields: { ...readPlanFields(sheet, sheet.getRow(6), month), coverageOnly: true } });
      });
      if (!parsed.length) throw new Error("No employee worksheets were found. Use the FieldDesk monthly template.");
      setRows(parsed); toast.success(`${parsed.length} filled row${parsed.length === 1 ? "" : "s"} read from ${file.name}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn?t read this workbook."); }
  };
  const checkRows = async () => { if (!rows.length) return; try { await validateUpload.mutateAsync({ month, rows, ...(templateMetadata ?? {}) }); } catch (error) { toast.error(error instanceof Error ? error.message : "Upload validation failed."); } };
  const submitValid = async () => {
    if (!user?.empCode || !validation?.validRows.length || validation.errors.length || validation.validRows.some(row => row.empCode !== user.empCode)) return;
    if (plan.data?.length && !window.confirm(`A plan already exists for ${month}. Submitting will replace your current plan. Continue?`)) return;
    setSubmitting(true);
    try { await submit.mutateAsync({ empCode: user.empCode, planMonth: month, items: validation.validRows.map(row => row.item), ...(templateMetadata ?? {}) }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not submit your plan."); }
    finally { setSubmitting(false); }
  };
  return <div className="view-stack monthly-plan-workspace"><div className="page-heading"><div><p className="eyebrow">WORKSPACE ? MONTHLY PLANNING</p><h1>My monthly plan.</h1><p className="page-subtitle">Download your Excel template, fill in your planned visits, then upload it for validation.</p></div><div className="report-icon"><FileSpreadsheet size={20} /></div></div>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">STEP 1 ? YOUR TEMPLATE</p><h2>{changeMode ? "Change my plan" : "Choose the planning month"}</h2></div></div>{monthOver && !changeMode && <p className="plan-sheet-not-submitted">This month is over. Nothing can be changed.</p>}<div className="plan-sheet-controls"><label className="filter-select"><span>Plan month</span><input type="month" value={month} onChange={event => { setMonth(event.target.value); setRows([]); setTemplateMetadata(null); setDayEdits([]); validateUpload.reset(); }} /></label></div>{changeMode && <><p className="plan-sheet-not-submitted">{monthOver ? "This month is over. Nothing can be changed." : `Days before ${new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${todayIndia}T00:00:00Z`))} are locked. You can change ${new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${todayIndia}T00:00:00Z`))} and later days.`}</p><div className="plan-sheet-downloads"><button className="button button-secondary" disabled={monthOver || plan.isLoading || editDaysMutation.isPending} onClick={() => { const editable = monthDays.filter(day => { const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); return day >= todayIndia && weekday !== 0 && !holidays.data?.some(item => item.holidayDate === day) && !changeInfo.data?.answeredDates.includes(day); }); setDayEdits(editable.map(createDayEdit)); setDayEditErrors({}); }}><Pencil size={15} />Edit all future days</button></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Day</th><th>Status</th></tr></thead><tbody>{monthDays.map(day => { const locked = day < todayIndia || changeInfo.data?.answeredDates.includes(day); return <tr key={day}><td>{new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`))}</td><td>{locked ? "Locked" : <button className="button button-secondary button-small" type="button" disabled={monthOver} onClick={() => { setDayEdits([createDayEdit(day)]); setDayEditErrors({}); }}>Edit</button>}</td></tr>; })}</tbody></table></div>{dayEdits.length > 0 && <div className="monthly-day-editor"><div className="panel-heading"><div><p className="eyebrow">IN-APP PLAN EDITOR</p><h2>{dayEdits.length === 1 ? "Edit this day" : `Edit ${dayEdits.length} future days`}</h2></div><button type="button" className="button button-ghost button-small" onClick={() => setDayEdits([])} aria-label="Cancel editing"><X size={15} /></button></div>{dayEdits.map((edit, index) => <fieldset className="monthly-day-edit" key={edit.date}><legend>{new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${edit.date}T00:00:00Z`))}</legend><label className="filter-select"><span>Day type</span><select value={edit.type} onChange={event => updateDayEdit(index, "type", event.target.value)}><option>Customer Visit</option><option>No Visit</option><option>Office</option><option>Leave</option></select></label>{edit.type === "Customer Visit" && <div className="monthly-day-fields"><label className="filter-select"><span>Customer Name</span><input value={edit.customerName} onChange={event => updateDayEdit(index, "customerName", event.target.value)} aria-invalid={Boolean(dayEditErrors[`${index}.customerName`])} />{dayEditErrors[`${index}.customerName`] && <small className="field-error">{dayEditErrors[`${index}.customerName`]}</small>}</label><label className="filter-select"><span>Location / City</span><input value={edit.location} onChange={event => updateDayEdit(index, "location", event.target.value)} aria-invalid={Boolean(dayEditErrors[`${index}.location`])} />{dayEditErrors[`${index}.location`] && <small className="field-error">{dayEditErrors[`${index}.location`]}</small>}</label><label className="filter-select"><span>Purpose</span><select value={edit.purpose} onChange={event => updateDayEdit(index, "purpose", event.target.value)} aria-invalid={Boolean(dayEditErrors[`${index}.purpose`])}><option value="">Choose purpose</option>{VISIT_PURPOSES.map(purpose => <option key={purpose}>{purpose}</option>)}</select>{dayEditErrors[`${index}.purpose`] && <small className="field-error">{dayEditErrors[`${index}.purpose`]}</small>}</label><label className="filter-select"><span>Remarks (optional)</span><input value={edit.remarks} onChange={event => updateDayEdit(index, "remarks", event.target.value)} /></label></div>}</fieldset>)}<div className="plan-sheet-downloads"><button type="button" className="button button-primary" disabled={editDaysMutation.isPending} onClick={saveDayEdits}><Save size={15} />{editDaysMutation.isPending ? "Saving…" : "Save plan"}</button><button type="button" className="button button-secondary" onClick={() => setDayEdits([])}>Cancel</button></div></div>}</>}{!changeMode && <p className="page-subtitle">This workbook contains only your employee details. Keep them unchanged while filling your planned visits.</p>}<div className="plan-sheet-downloads"><button className="button button-primary" disabled={!user?.empCode || busyDownload || plan.isLoading || monthOver} onClick={() => void downloadTemplate()}><Download size={16} />{busyDownload ? "Preparing?" : changeMode ? "Download template with my current plan" : "Download my Excel template"}</button></div></section>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">STEP 2 ? YOUR UPLOAD</p><h2>Upload your completed workbook</h2></div><span className="panel-chip"><Upload size={14} /> XLSX</span></div><label className="upload-drop"><Upload size={20} /><span><strong>{fileName || "Choose your completed FieldDesk template"}</strong><small>Only .xlsx files ? only your employee code will be accepted</small></span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event => { const file = event.target.files?.[0]; if (file) void readWorkbook(file); event.currentTarget.value = ""; }} /></label><p className="page-subtitle">Fill one row for every working day. Enter a customer visit, “No Visit”, “Office”, or “Leave”; Sundays and company holidays are excluded.</p>{rows.length > 0 && <div className="plan-sheet-downloads"><button className="button button-secondary" disabled={validateUpload.isPending} onClick={() => void checkRows()}>{validateUpload.isPending ? "Validating?" : "Validate my rows"}</button><span className="panel-count">{rows.length} rows found</span></div>}
      {validation && <div className="upload-validation"><div className={`upload-validation-summary ${validation.errors.length ? "has-errors" : "all-valid"}`}><strong>{validation.validCount} valid of {validation.totalRows} rows</strong><span>{validation.errors.length ? `${validation.errors.length} issue${validation.errors.length === 1 ? "" : "s"} need correction.` : "All rows are ready to submit."}</span></div>{validation.lockedErrors?.length > 0 && <div className="upload-row-errors"><h3><AlertTriangle size={15} /> Past days can't be changed</h3><div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Saved plan</th><th>Your file</th></tr></thead><tbody>{validation.lockedErrors.map((error, index) => <tr key={`${error.date}-${index}`}><td>{error.date}</td><td>{error.savedPlan}</td><td>{error.filePlan}</td></tr>)}</tbody></table></div></div>}{validation.errors.filter(error => error.field !== "Past days").length > 0 && <div className="upload-row-errors"><h3><AlertTriangle size={15} /> Fix the highlighted workbook rows and validate again</h3>{validation.errors.filter(error => error.field !== "Past days").map((error, index) => <p key={`${error.rowNumber}-${error.field}-${index}`}>{error.rowNumber > 0 && <b>Row {error.rowNumber} ? {error.field} </b>}{error.message}</p>)}</div>}{validation.validRows.length > 0 && <div className="table-scroll"><table className="data-table"><thead><tr><th>Row</th><th>Planned date</th><th>Customer</th><th>Location</th><th>Purpose</th><th>Ticket</th></tr></thead><tbody>{validation.validRows.slice(0, 20).map(row => <tr key={`${row.rowNumber}-${row.empCode}`}><td>{row.rowNumber}</td><td>{row.item.plannedDate}</td><td>{row.item.customerName}</td><td>{row.item.location}</td><td>{row.item.purpose}</td><td>{row.item.applyForTicket ? "Yes" : "No"}</td></tr>)}</tbody></table></div>}{validation.errors.length === 0 && validation.validRows.length > 0 && <div className="plan-sheet-downloads"><button className="button button-primary" disabled={submitting} onClick={() => void submitValid()}>{submitting ? "Submitting?" : `Submit ${validation.validCount} row${validation.validCount === 1 ? "" : "s"}`}</button></div>}</div>}
    </section></div>;
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
        const sheetStart = parsed.length;
        for (let rowNumber = 6; rowNumber <= sheet.rowCount; rowNumber++) {
          const row = sheet.getRow(rowNumber);
          const fields = readPlanFields(sheet, row, month);
          const hasUserData = [fields.plannedDate, fields.customerName, fields.location, fields.purpose, fields.travelMode, fields.routeFrom, fields.routeTo, fields.preferredDate, fields.remarks].some(Boolean) || String(fields.applyForTicket).toLowerCase() === "yes";
          if (hasUserData) parsed.push({ rowNumber, fields });
        }
        if (parsed.length === sheetStart) parsed.push({ rowNumber: 6, fields: { ...readPlanFields(sheet, sheet.getRow(6), month), coverageOnly: true } });
      });
      if (!parsed.length) throw new Error("No employee worksheets were found. Use the FieldDesk monthly input template.");
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
