import type { MonthlyPlanItemInput } from "../shared/fieldOps";

export type LockedPlanError = { rowNumber: number; field: string; message: string; date: string; savedPlan: string; filePlan: string };
type Candidate = { rowNumber: number; item: MonthlyPlanItemInput };

export class MonthlyPlanChangeRejected extends Error {
  constructor(readonly lockErrors: LockedPlanError[]) {
    super(lockErrors.map(error => error.message).join("\n"));
    this.name = "MonthlyPlanChangeRejected";
  }
}

function itemKey(item: MonthlyPlanItemInput) {
  return JSON.stringify([
    item.plannedDate,
    item.customerName.trim().toLocaleLowerCase("en-IN"),
    item.location.trim().toLocaleLowerCase("en-IN"),
    item.purpose,
    item.applyForTicket,
    item.travelMode ?? "",
    item.routeFrom?.trim().toLocaleLowerCase("en-IN") ?? "",
    item.routeTo?.trim().toLocaleLowerCase("en-IN") ?? "",
    item.preferredDate ?? "",
    item.remarks.trim(),
  ]);
}

export function takeMatchingPreviousPlanItem<T extends { plannedDate: string; customerName: string }>(remaining: T[], item: Pick<MonthlyPlanItemInput, "plannedDate" | "customerName">) {
  const normalizedCustomer = item.customerName.trim().toLocaleLowerCase("en-IN");
  const exactMatch = remaining.findIndex(row => row.customerName.trim().toLocaleLowerCase("en-IN") === normalizedCustomer && row.plannedDate === item.plannedDate);
  const matchIndex = exactMatch >= 0 ? exactMatch : remaining.findIndex(row => row.customerName.trim().toLocaleLowerCase("en-IN") === normalizedCustomer);
  return matchIndex >= 0 ? remaining.splice(matchIndex, 1)[0] : undefined;
}

export function describePlan(items: MonthlyPlanItemInput[]) {
  if (!items.length) return "No entry";
  return items.map(item => `${item.customerName}, ${item.location}, ${item.purpose}${item.applyForTicket ? `, ticket ${item.travelMode ?? ""} ${item.routeFrom ?? ""} to ${item.routeTo ?? ""} ${item.preferredDate ?? ""}` : ""}${item.remarks ? `, ${item.remarks}` : ""}`).join("; ");
}

function displayDate(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed);
}

export function checkLockedMonthlyPlanDays(args: {
  month: string;
  today: string;
  candidates: Candidate[];
  savedItems: MonthlyPlanItemInput[];
  answeredDates: string[];
  currentPlanVersion: number;
  basePlanVersion?: number;
  templateType?: "standard" | "change";
  enforce: boolean;
}): LockedPlanError[] {
  if (!args.enforce || args.currentPlanVersion === 0) return [];
  if (args.templateType !== "change" || args.basePlanVersion === undefined || args.basePlanVersion !== args.currentPlanVersion) {
    return [{ rowNumber: 0, field: "Template", date: "", savedPlan: "", filePlan: "", message: "Your plan changed after you downloaded this template. Download it again." }];
  }

  const lockedDates = new Set(args.answeredDates);
  const [year, month] = args.month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${args.month}-${String(day).padStart(2, "0")}`;
    if (date < args.today) lockedDates.add(date);
  }

  const errors: LockedPlanError[] = [];
  for (const date of [...lockedDates].filter(value => value.startsWith(`${args.month}-`)).sort()) {
    const saved = args.savedItems.filter(item => item.plannedDate === date);
    const submitted = args.candidates.filter(candidate => candidate.item.plannedDate === date);
    const remaining = new Map<string, number>();
    for (const item of saved) remaining.set(itemKey(item), (remaining.get(itemKey(item)) ?? 0) + 1);
    const unexpected: Candidate[] = [];
    for (const candidate of submitted) {
      const key = itemKey(candidate.item);
      const count = remaining.get(key) ?? 0;
      if (count) remaining.set(key, count - 1);
      else unexpected.push(candidate);
    }
    if (!unexpected.length && [...remaining.values()].every(count => count === 0)) continue;
    const savedPlan = describePlan(saved);
    for (const candidate of unexpected) errors.push({ rowNumber: candidate.rowNumber, field: "Past days", date, savedPlan, filePlan: describePlan([candidate.item]), message: `Row ${candidate.rowNumber} · ${displayDate(date)} has already passed or is locked by a daily check-in and can't be changed. Saved plan: ${savedPlan}. Your file: ${describePlan([candidate.item])}.` });
    const missing = [...remaining.values()].reduce((sum, count) => sum + count, 0);
    if (missing > 0 && submitted.length < saved.length) errors.push({ rowNumber: 0, field: "Past days", date, savedPlan, filePlan: describePlan(submitted.map(row => row.item)), message: `${displayDate(date)} has already passed or is locked by a daily check-in and can't be changed. Saved plan: ${savedPlan}. Your file: ${describePlan(submitted.map(row => row.item))}.` });
  }
  return errors;
}
