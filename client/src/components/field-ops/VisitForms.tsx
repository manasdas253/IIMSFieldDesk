import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Plus, Save, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { TRAVEL_MODES, VISIT_OUTCOMES, VISIT_PURPOSES, indiaDateString, nextMondayDate, planInputSchema, visitInputSchema, type PlanItemInput, type VisitInput } from "@shared/fieldOps";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { useFieldDraft } from "@/hooks/useFieldDraft";
import { trpc } from "@/lib/trpc";
import DailyVisitFlow from "./DailyVisitFlow";

type VisitDraft = { empCode: string; employeeName: string; visitDate: string; customerName: string; location: string; purpose: string; travelMode: string; distanceKm: string; travelCost: string; outcome: string; notes: string; followUpEnabled: boolean; followUpType: "Call" | "Email" | "Visit"; followUpDate: string; followUpTime: string; followUpNote: string; followUpPurpose: string };
type PlanDraft = { empCode: string; employeeName: string; weekStartingDate: string; items: Array<{ customerName: string; location: string; purpose: string; applyForTicket: boolean; travelMode: string; routeFrom: string; routeTo: string; preferredDate: string }> };
const initialVisit = (employeeName = "", empCode = ""): VisitDraft => ({ empCode, employeeName, visitDate: indiaDateString(), customerName: "", location: "", purpose: "Follow-up", travelMode: "", distanceKm: "", travelCost: "", outcome: "", notes: "", followUpEnabled: false, followUpType: "Call", followUpDate: "", followUpTime: "", followUpNote: "", followUpPurpose: "" });
const emptyPlanItem = () => ({ customerName: "", location: "", purpose: "Follow-up", applyForTicket: false, travelMode: "Train", routeFrom: "", routeTo: "", preferredDate: "" });
const initialPlan = (employeeName = "", empCode = ""): PlanDraft => ({ empCode, employeeName, weekStartingDate: nextMondayDate(), items: [emptyPlanItem()] });
const planPayload = (draft: PlanDraft) => ({ ...draft, items: draft.items.map(item => ({ ...item, travelMode: item.applyForTicket ? item.travelMode as PlanItemInput["travelMode"] : null, routeFrom: item.applyForTicket ? item.routeFrom : null, routeTo: item.applyForTicket ? item.routeTo : null, preferredDate: item.applyForTicket ? item.preferredDate : null })) });

type Errors = Record<string, string>;
function Field({ label, required, error, children, className = "" }: { label: string; required?: boolean; error?: string; children: ReactNode; className?: string }) {
  return <label className={`form-field ${className}`}><span className="field-label">{label}{required && <b aria-hidden="true">*</b>}</span>{children}{error && <span className="field-error">{error}</span>}</label>;
}
function inputClass(error?: string) { return `field-input${error ? " field-input-error" : ""}`; }
function errorMap(issues: Array<{ path: PropertyKey[]; message: string }>) { return Object.fromEntries(issues.map(issue => [String(issue.path.join(".")), issue.message])); }

function VisitEntryForm() {
  const currentUser = useCurrentUser();
  const draft = useFieldDraft<VisitDraft>("ckafield.visit-draft", initialVisit(currentUser?.employeeName ?? "", currentUser?.role === "employee" ? currentUser.empCode : ""));
  const { value: form, setValue: setForm, saveDraft, clearDraft, switchEmployee } = draft;
  const [employeeInput, setEmployeeInput] = useState(form.employeeName);
  const [errors, setErrors] = useState<Errors>({});
  const [quickMode, setQuickMode] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const utils = trpc.useUtils();
  const recent = trpc.fieldOps.visits.recent.useQuery({ limit: 100 });
  const employees = trpc.fieldOps.employees.list.useQuery({ includeInactive: false });
  useEffect(() => {
    if (!employees.data) return;
    const stored = localStorage.getItem("fielddesk:followup-prefill");
    if (!stored) return;
    localStorage.removeItem("fielddesk:followup-prefill");
    try {
      const prefill = JSON.parse(stored) as { empCode?: string; customerName?: string };
      const employee = employees.data.find(row => row.empCode === prefill.empCode);
      if (!employee) { toast.error("The follow-up employee is inactive. Select another employee to log the visit."); return; }
      const active = switchEmployee(employee.employeeName, initialVisit(employee.employeeName, employee.empCode), employee.empCode);
      setEmployeeInput(employee.employeeName);
      setForm({ ...active, customerName: prefill.customerName ?? "" });
    } catch { toast.error("Couldn’t restore the follow-up customer details."); }
  }, [employees.data]);
  const createFollowUp = trpc.fieldOps.followUps.create.useMutation();
  const createVisit = trpc.fieldOps.visits.create.useMutation({
    onSuccess: async visit => {
      let followUpFailed = false;
      if (form.followUpEnabled) {
        const followUpType = form.followUpType ?? "Call";
        try { await createFollowUp.mutateAsync({ visitId: visit.id, empCode: form.empCode, customerName: form.customerName, followUpDate: followUpType === "Visit" ? form.followUpDate : indiaDateString(), followUpTime: followUpType === "Visit" ? form.followUpTime : null, followUpPurpose: followUpType, note: form.followUpNote }); }
        catch { followUpFailed = true; }
      }
      clearDraft();
      setShowSuccess(true);
      setErrors({});
      await utils.invalidate();
      if (followUpFailed) toast.error("Visit saved, but its follow-up reminder could not be created."); else toast.success(form.followUpEnabled ? "Visit and follow-up saved" : "Visit logged successfully");
    },
    onError: error => { saveDraft(); toast.error(error.message || "Could not save this visit."); },
  });
  const customerHistory = useMemo(() => {
    const seen = new Set<string>();
    return (recent.data ?? []).filter(row => {
      const key = row.customerName.trim().toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [recent.data]);

  const setField = (name: Exclude<keyof VisitDraft, "employeeName" | "empCode">, value: string) => {
    setForm(previous => ({ ...previous, [name]: value }));
    setErrors(previous => { const next = { ...previous }; delete next[name]; return next; });
    setShowSuccess(false);
  };
  const selectEmployeeCode = (code: string) => {
    if (code) localStorage.setItem("fielddesk:lastEmpCode", code);
    const employee = employees.data?.find(row => row.empCode === code);
    const name = employee?.employeeName ?? "";
    const active = switchEmployee(name, initialVisit(name, code), code);
    setEmployeeInput(name);
    setForm({ ...active, empCode: code, employeeName: name });
    setErrors(previous => { const next = { ...previous }; delete next.empCode; delete next.employeeName; return next; });
  };

  const validateField = (name: keyof VisitDraft, draftValue = form) => {
    const parsed = visitInputSchema.safeParse({ ...draftValue, travelMode: draftValue.travelMode || undefined, distanceKm: draftValue.distanceKm.trim() === "" ? undefined : Number(draftValue.distanceKm), travelCost: draftValue.travelCost.trim() === "" ? undefined : Number(draftValue.travelCost) });
    const issue = parsed.success ? undefined : parsed.error.issues.find(item => String(item.path[0]) === name);
    setErrors(previous => { const next = { ...previous }; if (issue) next[name] = issue.message; else delete next[name]; return next; });
  };
  const blurField = (name: keyof VisitDraft) => { saveDraft(); validateField(name); };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const activeForm = switchEmployee(form.employeeName, initialVisit(form.employeeName, form.empCode), form.empCode);
    setEmployeeInput(activeForm.employeeName);
    saveDraft();
    const payload = { ...activeForm, distanceKm: activeForm.distanceKm.trim() === "" ? undefined : Number(activeForm.distanceKm), travelCost: activeForm.travelCost.trim() === "" ? undefined : Number(activeForm.travelCost), purpose: activeForm.purpose, travelMode: activeForm.travelMode || undefined };
    const parsed = visitInputSchema.safeParse(payload);
    if (!parsed.success) { setErrors(errorMap(parsed.error.issues)); return; }
    if (activeForm.followUpEnabled && activeForm.followUpType === "Visit" && !activeForm.followUpDate) { setErrors(previous => ({ ...previous, followUpDate: "Choose a follow-up date." })); return; }
    if (activeForm.followUpEnabled && activeForm.followUpType === "Visit" && (!/^\d{4}-\d{2}-\d{2}$/.test(activeForm.followUpDate) || Number.isNaN(Date.parse(`${activeForm.followUpDate}T00:00:00Z`)) || new Date(`${activeForm.followUpDate}T00:00:00Z`).toISOString().slice(0, 10) !== activeForm.followUpDate)) { setErrors(previous => ({ ...previous, followUpDate: "Enter a valid follow-up date." })); return; }
    if (activeForm.followUpEnabled && activeForm.followUpType === "Visit" && activeForm.followUpDate < indiaDateString()) { setErrors(previous => ({ ...previous, followUpDate: "Follow-up date must be today or later." })); return; }
    if (activeForm.followUpEnabled && activeForm.followUpType === "Visit" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(activeForm.followUpTime)) { setErrors(previous => ({ ...previous, followUpTime: "Choose a valid follow-up time." })); return; }
    if (activeForm.followUpEnabled && activeForm.followUpType === "Visit" && activeForm.followUpDate === indiaDateString()) {
      const now = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
      if (activeForm.followUpTime <= now) { setErrors(previous => ({ ...previous, followUpTime: "Choose a time later than now." })); return; }
    }
    createVisit.mutate(parsed.data as VisitInput);
  };

  if (currentUser?.role !== "admin") return <section className="personal-history"><div className="panel-heading"><div><p className="eyebrow">YOUR ACTIVITY</p><h3>Recent visits</h3></div></div>{recent.data?.length ? recent.data.slice(0, 8).map(row => <article key={row.id}><span className="personal-history-date">{row.visitDate}</span><div><strong>{row.customerName}</strong><small>{row.location} · {row.purpose}</small>{row.notes && <small>Notes: {row.notes}</small>}</div></article>) : <p className="page-subtitle">Your recent visits will appear here.</p>}</section>;
  if (showSuccess) return <section className="success-card"><div className="success-icon"><Check size={22} /></div><p className="eyebrow">SAVED TO THE VISIT LOG</p><h2>Visit recorded.</h2><p>Your visit is now included in the team’s field activity.</p><button className="button button-primary" onClick={() => { setForm(initialVisit(employeeInput)); setShowSuccess(false); }}>Log another visit <ArrowRight size={17} /></button></section>;

  return <form className="form-card" onSubmit={submit} noValidate>
    <div className="form-intro"><div><p className="eyebrow">DAILY VISIT LOG</p><h2>Capture the visit while it’s fresh.</h2><p>One customer at a time. Log again whenever the day moves on.</p></div><button type="button" className={`quick-toggle${quickMode ? " active" : ""}`} onClick={() => setQuickMode(value => !value)}><Zap size={16} /> Quick log</button></div>
    {quickMode && <div className="quick-log-panel"><div><strong>Repeat a recent customer</strong><span>Pick the latest matching visit to prefill this entry.</span></div><select className="field-input quick-customer" value="" onChange={event => { const visit = recent.data?.find(row => String(row.id) === event.target.value); if (!visit) return; const employee = employees.data?.find(row => row.empCode === visit.empCode); const code = employee?.empCode ?? ""; const name = employee?.employeeName ?? ""; const active = switchEmployee(name, initialVisit(name, code), code); setEmployeeInput(name); setForm({ ...active, empCode: code, employeeName: name, customerName: visit.customerName, location: visit.location, purpose: visit.purpose, travelMode: visit.travelMode, distanceKm: String(visit.distanceKm), travelCost: String(visit.travelCost) }); }}><option value="">Choose a recent customer…</option>{customerHistory.map(row => <option key={row.id} value={row.id}>{row.customerName} · {row.location} · {row.visitDate}</option>)}</select></div>}
    <div className="form-grid">
      <Field label="Emp Code" required error={errors.empCode}><select disabled={currentUser?.role !== "admin"} className={inputClass(errors.empCode)} value={form.empCode} onChange={event => selectEmployeeCode(event.target.value)}><option value="">Select an active employee…</option>{(employees.data ?? []).map(employee => <option key={employee.empCode} value={employee.empCode}>{employee.empCode} · {employee.employeeName}</option>)}</select></Field>
      <Field label="Employee name" required><input className="field-input" value={form.employeeName} readOnly aria-readonly="true" /></Field>
      <Field label="Visit date" required error={errors.visitDate}><input className={inputClass(errors.visitDate)} type="date" value={form.visitDate} onChange={event => setField("visitDate", event.target.value)} onBlur={() => blurField("visitDate")} /></Field>
      <Field label="Customer name" required error={errors.customerName}><input className={inputClass(errors.customerName)} list="field-customer-list" value={form.customerName} onChange={event => setField("customerName", event.target.value)} onBlur={() => blurField("customerName")} placeholder="e.g. North Star Industries" /></Field>
      <Field label="Location / city" required error={errors.location}><input className={inputClass(errors.location)} value={form.location} onChange={event => setField("location", event.target.value)} onBlur={() => blurField("location")} placeholder="City or site location" /></Field>
      <Field label="Purpose of visit" required error={errors.purpose}><select className={inputClass(errors.purpose)} value={form.purpose} onChange={event => setField("purpose", event.target.value)} onBlur={() => blurField("purpose")}>{VISIT_PURPOSES.map(value => <option key={value}>{value}</option>)}</select></Field>
      <Field label="Travel mode" error={errors.travelMode}><select className={inputClass(errors.travelMode)} value={form.travelMode} onChange={event => setField("travelMode", event.target.value)} onBlur={() => blurField("travelMode")}><option value="">Select when known</option>{TRAVEL_MODES.map(value => <option key={value}>{value}</option>)}</select></Field>
      <Field label="Distance" error={errors.distanceKm}><div className="input-suffix"><input className={inputClass(errors.distanceKm)} type="number" min="0" step="0.1" inputMode="decimal" value={form.distanceKm} onChange={event => setField("distanceKm", event.target.value)} onBlur={() => blurField("distanceKm")} placeholder="Optional" /><span>km</span></div></Field>
      <Field label="Travel cost" error={errors.travelCost}><div className="input-prefix"><span>₹</span><input className={inputClass(errors.travelCost)} type="number" min="0" step="0.01" inputMode="decimal" value={form.travelCost} onChange={event => setField("travelCost", event.target.value)} onBlur={() => blurField("travelCost")} placeholder="Optional" /></div></Field>
      <Field label="Visit outcome" required error={errors.outcome} className="field-span-2"><input className={inputClass(errors.outcome)} list="field-outcome-list" value={form.outcome} onChange={event => setField("outcome", event.target.value)} onBlur={() => blurField("outcome")} placeholder="Choose or enter a short outcome" /><datalist id="field-outcome-list">{VISIT_OUTCOMES.map(value => <option key={value} value={value} />)}</datalist></Field>
      <Field label="Notes" className="field-span-2"><textarea className="field-input field-textarea" rows={3} value={form.notes} onChange={event => setField("notes", event.target.value)} onBlur={() => blurField("notes")} placeholder="Optional details for the team…" /></Field>
      <div className="follow-up-section field-span-2"><label className="follow-up-check"><input type="checkbox" checked={form.followUpEnabled} onChange={event => { setForm(previous => ({ ...previous, followUpEnabled: event.target.checked })); setErrors(previous => { const next = { ...previous }; delete next.followUpDate; delete next.followUpTime; return next; }); saveDraft(); }} /><span><strong>Follow-up Needed</strong><small>Create a next step linked to this customer visit.</small></span></label>{form.followUpEnabled && <div className="form-grid follow-up-fields"><Field label="Follow-up type" required><select className="field-input" value={form.followUpType ?? "Call"} onChange={event => { setField("followUpType", event.target.value as VisitDraft["followUpType"]); setErrors(previous => { const next = { ...previous }; delete next.followUpDate; delete next.followUpTime; return next; }); }}><option>Call</option><option>Email</option><option>Visit</option></select></Field>{form.followUpType === "Visit" && <><Field label="Follow-up date" required error={errors.followUpDate}><input className={inputClass(errors.followUpDate)} type="date" required min={indiaDateString()} value={form.followUpDate} onChange={event => setField("followUpDate", event.target.value)} /></Field><Field label="Follow-up time" required error={errors.followUpTime}><input className={inputClass(errors.followUpTime)} type="time" required value={form.followUpTime} onChange={event => setField("followUpTime", event.target.value)} /></Field></>}<Field label="Reminder note" className="field-span-2"><textarea className="field-input field-textarea" rows={2} maxLength={4000} value={form.followUpNote} onChange={event => setField("followUpNote", event.target.value)} placeholder="Optional details…" /></Field></div>}</div>
    </div>
    <datalist id="field-customer-list">{customerHistory.map(row => <option key={row.id} value={row.customerName} />)}</datalist>
    <div className="form-bottom"><span className="draft-hint"><Save size={14} /> Draft saves on field blur</span><button className="button button-primary" type="submit" disabled={createVisit.isPending}>{createVisit.isPending ? "Saving…" : "Save visit log"}<ArrowRight size={17} /></button></div>
  </form>;
}

function PlanEntryForm() {
  const currentUser = useCurrentUser();
  const draft = useFieldDraft<PlanDraft>("ckafield.plan-draft", initialPlan(currentUser?.employeeName ?? "", currentUser?.role === "employee" ? currentUser.empCode : ""));
  const { value: form, setValue: setForm, saveDraft, clearDraft, switchEmployee } = draft;
  const [employeeInput, setEmployeeInput] = useState(form.employeeName);
  const [errors, setErrors] = useState<Errors>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const utils = trpc.useUtils();
  const employees = trpc.fieldOps.employees.list.useQuery({ includeInactive: false });
  const existingPlans = trpc.fieldOps.plans.list.useQuery({}, { enabled: currentUser?.role === "employee" });
  const createPlan = trpc.fieldOps.plans.create.useMutation({
    onSuccess: async () => { clearDraft(); setShowSuccess(true); await utils.invalidate(); toast.success("Weekly plan submitted"); },
    onError: error => { saveDraft(); toast.error(error.message || "Could not save this plan."); },
  });
  const setTop = (name: "weekStartingDate", value: string) => { setForm(previous => ({ ...previous, [name]: value })); setErrors(previous => { const next = { ...previous }; delete next[name]; return next; }); setShowSuccess(false); };
  const selectEmployeeCode = (code: string) => {
    if (code) localStorage.setItem("fielddesk:lastEmpCode", code);
    const employee = employees.data?.find(row => row.empCode === code);
    const name = employee?.employeeName ?? "";
    const active = switchEmployee(name, initialPlan(name, code), code);
    setEmployeeInput(name);
    setForm({ ...active, empCode: code, employeeName: name });
    setErrors(previous => { const next = { ...previous }; delete next.empCode; delete next.employeeName; return next; });
  };
  const setItem = (index: number, name: keyof PlanDraft["items"][number], value: string | boolean) => {
    setForm(previous => ({ ...previous, items: previous.items.map((item, itemIndex) => itemIndex === index ? { ...item, [name]: value } : item) }));
    setErrors(previous => { const next = { ...previous }; delete next[`items.${index}.${name}`]; return next; });
  };
  const validateField = (path: string, draftValue = form) => {
    const parsed = planInputSchema.safeParse(planPayload(draftValue));
    const isTicketToggle = path.endsWith(".applyForTicket");
    const prefix = isTicketToggle ? `${path.slice(0, -".applyForTicket".length)}.` : "";
    const issues = parsed.success ? [] : parsed.error.issues.filter(issue => isTicketToggle ? issue.path.join(".").startsWith(prefix) : issue.path.join(".") === path);
    setErrors(previous => {
      const next = { ...previous };
      for (const key of Object.keys(next)) if (key === path || (prefix && key.startsWith(prefix))) delete next[key];
      for (const issue of issues) next[String(issue.path.join("."))] = issue.message;
      return next;
    });
    saveDraft();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const activeForm = switchEmployee(form.employeeName, initialPlan(form.employeeName, form.empCode), form.empCode);
    setEmployeeInput(activeForm.employeeName);
    saveDraft();
    const parsed = planInputSchema.safeParse(planPayload(activeForm));
    if (!parsed.success) { setErrors(errorMap(parsed.error.issues)); return; }
    createPlan.mutate(parsed.data);
  };

  if (showSuccess) return <section className="success-card"><div className="success-icon"><Check size={22} /></div><p className="eyebrow">PLAN SUBMITTED</p><h2>Next week is on the map.</h2><p>{form.items.length} planned {form.items.length === 1 ? "customer" : "customers"} for the week starting {form.weekStartingDate}.</p><button className="button button-primary" onClick={() => { setForm(initialPlan(employeeInput)); setShowSuccess(false); }}>Create another plan <ArrowRight size={17} /></button></section>;

  return <form className="form-card" onSubmit={submit} noValidate>
    <div className="form-intro"><div><p className="eyebrow">NEXT WEEK’S PLAN</p><h2>Put the next week in motion.</h2><p>Set a clear route for the team and flag any travel ticket requests.</p></div><span className="form-step-label">WEEKLY SUBMISSION</span></div>
    <div className="form-grid form-grid-top"><Field label="Emp Code" required error={errors.empCode}><select disabled={currentUser?.role !== "admin"} className={inputClass(errors.empCode)} value={form.empCode} onChange={event => selectEmployeeCode(event.target.value)}><option value="">Select an active employee…</option>{(employees.data ?? []).map(employee => <option key={employee.empCode} value={employee.empCode}>{employee.empCode} · {employee.employeeName}</option>)}</select></Field><Field label="Employee name" required><input className="field-input" value={form.employeeName} readOnly aria-readonly="true" /></Field><Field label="Week starting" required error={errors.weekStartingDate}><input className={inputClass(errors.weekStartingDate)} type="date" value={form.weekStartingDate} onChange={event => setTop("weekStartingDate", event.target.value)} onBlur={() => validateField("weekStartingDate")} /></Field></div>
    <div className="plan-items-heading"><div><p className="eyebrow">ROUTE DETAILS</p><h3>Planned customers</h3></div><button className="button button-secondary button-small" type="button" onClick={() => { setForm(previous => ({ ...previous, items: [...previous.items, emptyPlanItem()] })); saveDraft(); }}><Plus size={15} /> Add customer</button></div>
    <div className="planned-items">{form.items.map((item, index) => <section className="planned-item" key={index}><div className="planned-item-top"><span className="item-index">0{index + 1}</span><span className="item-caption">PLANNED STOP</span>{form.items.length > 1 && <button type="button" className="icon-button danger-icon" onClick={() => { setForm(previous => ({ ...previous, items: previous.items.filter((_, itemIndex) => itemIndex !== index) })); saveDraft(); }} aria-label={`Remove planned customer ${index + 1}`}><Trash2 size={16} /></button>}</div>
      <div className="form-grid"><Field label="Planned customer" required error={errors[`items.${index}.customerName`]}><input className={inputClass(errors[`items.${index}.customerName`])} value={item.customerName} onChange={event => setItem(index, "customerName", event.target.value)} onBlur={() => validateField(`items.${index}.customerName`)} placeholder="Customer or account" /></Field><Field label="Location" required error={errors[`items.${index}.location`]}><input className={inputClass(errors[`items.${index}.location`])} value={item.location} onChange={event => setItem(index, "location", event.target.value)} onBlur={() => validateField(`items.${index}.location`)} placeholder="City or site" /></Field><Field label="Purpose" required error={errors[`items.${index}.purpose`]}><select className={inputClass(errors[`items.${index}.purpose`])} value={item.purpose} onChange={event => setItem(index, "purpose", event.target.value)} onBlur={() => validateField(`items.${index}.purpose`)}>{VISIT_PURPOSES.map(value => <option key={value}>{value}</option>)}</select></Field>
      <label className="ticket-toggle"><input type="checkbox" checked={item.applyForTicket} onChange={event => setItem(index, "applyForTicket", event.target.checked)} onBlur={() => validateField(`items.${index}.applyForTicket`)} /><span className="toggle-track" /><span><strong>Apply for a ticket</strong><small>Request travel booking details</small></span></label>
      {item.applyForTicket && <div className="ticket-fields field-span-2"><Field label="Travel mode" required error={errors[`items.${index}.travelMode`]}><select className={inputClass(errors[`items.${index}.travelMode`])} value={item.travelMode} onChange={event => setItem(index, "travelMode", event.target.value)} onBlur={() => validateField(`items.${index}.travelMode`)}>{TRAVEL_MODES.map(value => <option key={value}>{value}</option>)}</select></Field><Field label="From" required error={errors[`items.${index}.routeFrom`]}><input className={inputClass(errors[`items.${index}.routeFrom`])} value={item.routeFrom} onChange={event => setItem(index, "routeFrom", event.target.value)} onBlur={() => validateField(`items.${index}.routeFrom`)} placeholder="Departure" /></Field><Field label="To" required error={errors[`items.${index}.routeTo`]}><input className={inputClass(errors[`items.${index}.routeTo`])} value={item.routeTo} onChange={event => setItem(index, "routeTo", event.target.value)} onBlur={() => validateField(`items.${index}.routeTo`)} placeholder="Arrival" /></Field><Field label="Preferred date" required error={errors[`items.${index}.preferredDate`]}><input className={inputClass(errors[`items.${index}.preferredDate`])} type="date" value={item.preferredDate} onChange={event => setItem(index, "preferredDate", event.target.value)} onBlur={() => validateField(`items.${index}.preferredDate`)} /></Field></div>}
      </div></section>)}</div>
    <div className="form-bottom"><span className="draft-hint"><Save size={14} /> Draft saves on field blur</span><button className="button button-primary" type="submit" disabled={createPlan.isPending}>{createPlan.isPending ? "Submitting…" : "Submit weekly plan"}<ArrowRight size={17} /></button></div>
    {currentUser?.role === "employee" && <section className="personal-history"><div className="panel-heading"><div><p className="eyebrow">YOUR ACTIVITY</p><h3>Submitted weekly plans</h3></div></div>{existingPlans.data?.length ? existingPlans.data.slice(0, 8).map(plan => <article key={plan.id}><span className="personal-history-date">{plan.weekStartingDate}</span><div><strong>{plan.items.length} planned {plan.items.length === 1 ? "stop" : "stops"}</strong><small>{plan.items.slice(0, 2).map(item => item.customerName).join(" / ") || "No customer names"}</small></div></article>) : <p className="page-subtitle">Your submitted weekly plans will appear here.</p>}</section>}
  </form>;
}

export default function VisitForms({ initialSection = "visit" }: { initialSection?: "visit" | "plan" }) {
  const [section, setSection] = useState<"visit" | "plan">(initialSection);
  return <div className="capture-page"><div className="page-heading"><div><p className="eyebrow">FIELD CAPTURE</p><h1>Make every visit count.</h1><p className="page-subtitle">A fast, dependable record of what happened and what comes next.</p></div><div className="capture-date"><span>TODAY</span><strong>{new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date())}</strong></div></div>
    <div className="section-tabs" role="tablist" aria-label="Field capture sections"><button type="button" role="tab" aria-selected={section === "visit"} className={section === "visit" ? "selected" : ""} onClick={() => setSection("visit")}><span className="tab-number">01</span><span><strong>Daily visit log</strong><small>One entry per customer visit</small></span><ChevronRight size={16} /></button><button type="button" role="tab" aria-selected={section === "plan"} className={section === "plan" ? "selected" : ""} onClick={() => setSection("plan")}><span className="tab-number">02</span><span><strong>Next week’s plan</strong><small>Map the route ahead</small></span><ChevronRight size={16} /></button></div>
    {section === "visit" ? <><DailyVisitFlow /><VisitEntryForm /></> : <PlanEntryForm />}
  </div>;
}
