import { useMemo, useState } from "react";
import { CalendarDays, Check, CircleAlert, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { indiaDateString, VISIT_OUTCOMES, VISIT_PURPOSES } from "@shared/fieldOps";
import { trpc } from "@/lib/trpc";
import { useCurrentUser } from "@/contexts/CurrentUserContext";

type Stop = { id: number; plannedVisitId: number | null; customerName: string; location: string; purpose: string; plannedDate: string; movedFrom: string | null; planVersion: number; parentStatusId?: number; completedOn?: string | null; status?: "Planned" | "Visited" | "Missed" | "Rescheduled"; newDate?: string | null };
const todayString = () => indiaDateString();
const minusDays = (date: string, days: number) => { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() - days); return value.toISOString().slice(0, 10); };

export default function DailyVisitFlow() {
  const user = useCurrentUser();
  const [date, setDate] = useState(todayString());
  const [active, setActive] = useState<Stop | "unplanned" | null>(null);
  const [status, setStatus] = useState<"Visited" | "Missed" | "Rescheduled">("Visited");
  const [reason, setReason] = useState("Customer unavailable");
  const [newDate, setNewDate] = useState("");
  const [addAsAdditional, setAddAsAdditional] = useState(false);
  const [outcome, setOutcome] = useState("Positive");
  const [notes, setNotes] = useState("");
  const [visitedPersonName, setVisitedPersonName] = useState("");
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpType, setFollowUpType] = useState<"Call" | "Email" | "Visit">("Call");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [completeFollowUpId, setCompleteFollowUpId] = useState<number | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [location, setLocation] = useState("");
  const [unplannedPurpose, setUnplannedPurpose] = useState<(typeof VISIT_PURPOSES)[number]>("Other");
  const utils = trpc.useUtils();
  const daily = trpc.fieldOps.dailyVisit.today.useQuery({ date });
  const destination = trpc.fieldOps.dailyVisit.today.useQuery({ date: newDate }, { enabled: status === "Rescheduled" && Boolean(newDate) });
  const openFollowUps = trpc.fieldOps.followUps.list.useQuery({ status: "Pending" });
  const holidays = trpc.fieldOps.holidays.list.useQuery({ from: date, to: date });
  const save = trpc.fieldOps.dailyVisit.save.useMutation({ onSuccess: async () => { toast.success("Daily visit saved"); setActive(null); setNewDate(""); setNotes(""); setFollowUpNeeded(false); setFollowUpDate(""); setFollowUpTime(""); await utils.invalidate(); }, onError: error => toast.error(error.message) });
  const workingDay = new Date(`${date}T00:00:00Z`).getUTCDay() !== 0 && !holidays.data?.length;
  const destinationStops = (destination.data?.planned.length ?? 0) + (destination.data?.moved.length ?? 0);
  const stops: Stop[] = useMemo(() => {
    if (!daily.data) return [];
    return [...daily.data.planned, ...daily.data.moved.map(item => ({ ...item, parentStatusId: item.id }))];
  }, [daily.data]);
  const displayed = stops.map(stop => {
    const answer = daily.data?.statuses.find(row => row.plannedVisitId === stop.plannedVisitId && row.visitDate === date && row.status !== "Planned");
    return { ...stop, answer };
  });
  const customerFollowUp = (customer: string) => openFollowUps.data?.find(item => item.customerName.trim().toLocaleLowerCase() === customer.trim().toLocaleLowerCase());
  const launch = (target: Stop | "unplanned") => { setActive(target); setStatus("Visited"); setReason("Customer unavailable"); setOutcome("Positive"); setVisitedPersonName(""); setCompleteFollowUpId(null); setCustomerName(""); setLocation(""); setUnplannedPurpose("Other"); setMergeTargetId(null); if (target !== "unplanned" && target.parentStatusId) { const same = daily.data?.planned.find(item => item.customerName.trim().toLocaleLowerCase() === target.customerName.trim().toLocaleLowerCase() && item.plannedVisitId !== target.plannedVisitId); if (same && same.plannedVisitId && window.confirm(`${target.customerName} is already planned for this date. Merge into one visit?`)) setMergeTargetId(same.plannedVisitId); } };
  const submit = () => {
    if (!active || !user) return;
    const stop = active === "unplanned" ? null : active;
    const customer = stop?.customerName ?? customerName;
    const site = stop?.location ?? location;
    if (!customer.trim() || !site.trim()) { toast.error("Add the customer and location."); return; }
    if (status === "Visited" && !visitedPersonName.trim()) { toast.error("Enter the name of the person you visited."); return; }
    const today = todayString();
    if (status === "Visited" && followUpNeeded && followUpType === "Visit") {
      if (!followUpDate) { toast.error("Choose a follow-up date."); return; }
      const parsedDate = new Date(`${followUpDate}T00:00:00Z`);
      if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== followUpDate) { toast.error("Enter a valid follow-up date."); return; }
      if (followUpDate < today) { toast.error("Follow-up date must be today or later."); return; }
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(followUpTime)) { toast.error("Choose a valid follow-up time."); return; }
      if (followUpDate === today) {
        const now = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
        if (followUpTime <= now) { toast.error("Choose a time later than now."); return; }
      }
    }
    const scheduledDate = followUpType === "Visit" ? followUpDate : today;
    save.mutate({ visitDate: date, plannedVisitId: stop?.plannedVisitId ?? null, parentStatusId: stop?.parentStatusId ?? null, mergeIntoPlannedVisitId: status === "Visited" ? mergeTargetId : null, originalPlannedDate: stop?.movedFrom ?? (stop ? date : null), customerName: customer, visitedPersonName: status === "Visited" ? visitedPersonName.trim() : undefined, location: site, purpose: stop?.purpose ?? unplannedPurpose, source: stop ? "Planned" : "Unplanned", status, reason: status === "Missed" || status === "Rescheduled" ? (status === "Rescheduled" ? "Rescheduled" : reason as "Customer unavailable" | "Internal work" | "Leave" | "Other") : null, newDate: status === "Rescheduled" ? newDate : null, outcome: status === "Visited" ? outcome : "", notes, followUpDate: status === "Visited" && followUpNeeded ? scheduledDate : null, followUpTime: status === "Visited" && followUpNeeded && followUpType === "Visit" ? followUpTime : null, followUpPurpose: status === "Visited" && followUpNeeded ? followUpType : "", completeFollowUpId: status === "Visited" ? completeFollowUpId : null, lateEntry: date < today });
  };
  const today = todayString();
  const pickedStop = active && active !== "unplanned" ? active : null;
  const activeCustomerName = pickedStop?.customerName ?? (active === "unplanned" ? customerName : "");
  const existingFollowUp = activeCustomerName ? customerFollowUp(activeCustomerName) : null;

  return <section className="panel daily-visit-flow">
    <div className="panel-heading"><div><p className="eyebrow">TODAY'S CHECK-IN</p><h2>Planned visits</h2><p className="page-subtitle">Answer once for each stop. It takes about a minute.</p></div><label className="filter-select"><span>Visit date</span><input type="date" min={minusDays(today, 2)} max={today} value={date} onChange={event => { setDate(event.target.value); setActive(null); }} /></label></div>
    {daily.isLoading ? <p className="page-subtitle">Loading your plan…</p> : <>
      {!workingDay && <p className="daily-friendly"><CalendarDays size={16} />No working-day plan is expected for this date. You can still log an unplanned visit.</p>}
      {stops.length > 5 && <p className="daily-friendly"><CircleAlert size={16} />You have {stops.length} visits planned for this day. This is a little more than usual, but you can continue.</p>}
      {displayed.length === 0 && <p className="daily-friendly"><CalendarDays size={16} />Nothing was planned for you on this date. You can still log an unplanned visit.</p>}
      <div className="daily-stop-list">{displayed.map(stop => <article className="daily-stop" key={`${stop.id}-${stop.movedFrom ?? "plan"}`}>
        <div><strong>{stop.customerName}</strong><small>{stop.location} · {stop.purpose}</small>{stop.movedFrom && <span className="daily-moved">Moved from {stop.movedFrom}{stop.movedFrom.slice(0, 7) !== date.slice(0, 7) ? ` · Carried over from ${stop.movedFrom.slice(0, 7)}` : ""}</span>}{stop.answer?.status === "Rescheduled" && <span className="daily-moved">Rescheduled to {stop.answer.newDate}</span>}</div>
        {stop.completedOn ? <span className="employee-status active">Visited on {stop.completedOn}</span> : stop.answer ? <span className={`employee-status ${stop.answer.status === "Visited" ? "active" : "inactive"}`}>{stop.answer.status}</span> : <button type="button" className="button daily-visit-prompt" onClick={() => launch(stop)}><span>Did you visit?</span><span aria-hidden="true">→</span></button>}
      </article>)}</div>
      <button type="button" className="button button-secondary button-small" onClick={() => launch("unplanned")}><Plus size={15} />Log an unplanned visit</button>
      {date < today && <p className="daily-friendly"><CircleAlert size={15} />This will be marked as a late entry.</p>}
    </>}
    {active && <div className={`daily-action-form${active === "unplanned" ? " is-unplanned" : ""}`}>
      <div className="panel-heading"><div><p className="eyebrow">{active === "unplanned" ? "UNPLANNED VISIT" : "DAILY RESPONSE"}</p><h3>{active === "unplanned" ? "Log a visit" : `Today's planned visit is ${active.customerName}. Did you visit?`}</h3></div><button className="icon-button" type="button" onClick={() => setActive(null)} aria-label="Close">×</button></div>
      {active === "unplanned" && <div className="form-grid unplanned-fields"><label className="form-field"><span className="field-label">Customer</span><input className="field-input" value={customerName} onChange={event => setCustomerName(event.target.value)} /></label><label className="form-field"><span className="field-label">Location</span><input className="field-input" value={location} onChange={event => setLocation(event.target.value)} /></label><label className="form-field"><span className="field-label">Purpose of visit</span><select className="field-input" value={unplannedPurpose} onChange={event => setUnplannedPurpose(event.target.value as (typeof VISIT_PURPOSES)[number])}>{VISIT_PURPOSES.map(purpose => <option key={purpose} value={purpose}>{purpose}</option>)}</select></label></div>}
      <div className="daily-choice-row"><button type="button" className={`button ${status === "Visited" ? "button-primary" : "button-secondary"}`} onClick={() => setStatus("Visited")}><Check size={15} />Yes, visited</button>{active !== "unplanned" && <><button type="button" className={`button ${status === "Missed" ? "button-primary" : "button-secondary"}`} onClick={() => setStatus("Missed")}>No, missed</button><button type="button" className={`button ${status === "Rescheduled" ? "button-primary" : "button-secondary"}`} onClick={() => setStatus("Rescheduled")}><RotateCcw size={15} />Reschedule</button></>}</div>
      {status === "Visited" ? <div className="form-grid"><label className="form-field field-span-2"><span className="field-label">Visited Person Name<b aria-hidden="true">*</b></span><input className="field-input" required maxLength={120} value={visitedPersonName} onChange={event => setVisitedPersonName(event.target.value)} placeholder="Who did you meet?" /></label><label className="form-field"><span className="field-label">Outcome</span><select className="field-input" value={outcome} onChange={event => setOutcome(event.target.value)}>{VISIT_OUTCOMES.map(item => <option key={item}>{item}</option>)}</select></label><label className="form-field field-span-2"><span className="field-label">Notes</span><textarea className="field-input field-textarea" rows={2} value={notes} onChange={event => setNotes(event.target.value)} /></label>{existingFollowUp && <label className="follow-up-check field-span-2"><input type="checkbox" checked={completeFollowUpId === existingFollowUp.id} onChange={event => setCompleteFollowUpId(event.target.checked ? existingFollowUp.id : null)} /><span><strong>Mark open follow-up done?</strong><small>{existingFollowUp.followUpDate} · {existingFollowUp.followUpPurpose || existingFollowUp.note || "Next step"}</small></span></label>}<label className="follow-up-check field-span-2"><input type="checkbox" checked={followUpNeeded} onChange={event => setFollowUpNeeded(event.target.checked)} /><span><strong>Is a follow-up needed?</strong><small>Add a call, email, or scheduled visit reminder.</small></span></label>{followUpNeeded && <label className="form-field"><span className="field-label">Follow-up type</span><select className="field-input" value={followUpType} onChange={event => setFollowUpType(event.target.value as "Call" | "Email" | "Visit")}><option>Call</option><option>Email</option><option>Visit</option></select></label> }{followUpNeeded && followUpType === "Visit" && <><label className="form-field"><span className="field-label">Follow-up date</span><input className="field-input" type="date" required min={today} value={followUpDate} onChange={event => setFollowUpDate(event.target.value)} /></label><label className="form-field"><span className="field-label">Time</span><input className="field-input" type="time" required value={followUpTime} onChange={event => setFollowUpTime(event.target.value)} /></label></>}</div> : <div className="form-grid">{status === "Missed" && <label className="form-field"><span className="field-label">Reason</span><select className="field-input" value={reason} onChange={event => setReason(event.target.value)}>{["Customer unavailable", "Rescheduled", "Internal work", "Leave", "Other"].filter(item => item !== "Rescheduled").map(item => <option key={item}>{item}</option>)}</select></label>}{status === "Rescheduled" && <><label className="form-field"><span className="field-label">Reason</span><input className="field-input" value="Rescheduled" readOnly /></label><label className="form-field"><span className="field-label">New working date</span><input className="field-input" type="date" min={date} value={newDate} onChange={event => { setNewDate(event.target.value); setAddAsAdditional(false); }} /></label><label className="form-field field-span-2"><span className="field-label">Notes</span><textarea className="field-input field-textarea" rows={2} value={notes} onChange={event => setNotes(event.target.value)} /></label></>}</div>}
      {status === "Rescheduled" && newDate && !destination.isLoading && <div className="daily-friendly"><CalendarDays size={16}/>{destinationStops === 0 ? "No planned visit on this date. This visit will be rescheduled directly." : <><span>{newDate} already has {destinationStops} planned {destinationStops === 1 ? "stop" : "stops"}.</span><label className="form-field"><span className="field-label">Choose another working day with no plan</span><input className="field-input" type="date" min={date} value={newDate} onChange={event => { setNewDate(event.target.value); setAddAsAdditional(false); }} /></label><button type="button" className={`button ${addAsAdditional ? "button-primary" : "button-secondary"} button-small`} onClick={() => setAddAsAdditional(true)}>Add as an additional stop</button></>}</div>}
      <div className="form-bottom"><span>{active === "unplanned" ? "Saved with optional Unplanned source tag" : "Linked to your monthly plan"}</span><button type="button" className="button button-primary" disabled={save.isPending || (status === "Rescheduled" && (!newDate || destination.isLoading || (destinationStops > 0 && !addAsAdditional)))} onClick={submit}>{save.isPending ? "Saving…" : "Save daily response"}</button></div>
    </div>}
  </section>;
}
