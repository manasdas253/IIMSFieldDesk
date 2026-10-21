import { mkdir, writeFile } from "node:fs/promises";
import { buildMonthlyPlanSheetData } from "../server/exports/monthlyPlanSheet/buildData";
import { renderMonthlyPlanPdf } from "../server/exports/monthlyPlanSheet/renderPdf";
import { renderMonthlyPlanXlsx } from "../server/exports/monthlyPlanSheet/renderXlsx";

const month = "2026-10";
const data = buildMonthlyPlanSheetData({
  month,
  generatedAt: new Date("2026-10-01T03:30:00.000Z"),
  employee: { empCode: "SAMPLE01", employeeName: "Sample Employee", designation: "Territory Manager", department: "Sales" },
  plan: { version: 1, status: "Submitted", submittedAt: new Date("2026-10-01T03:00:00.000Z") },
  items: [
    { plannedDate: "2026-10-05", customerName: "Fixture Customer North", location: "Hyderabad", purpose: "New Lead", remarks: "Review product requirements", applyForTicket: false },
    { plannedDate: "2026-10-08", customerName: "Fixture Customer South", location: "Chennai", purpose: "Follow-up", remarks: "Share revised offer", applyForTicket: true },
  ],
});
await mkdir("samples", { recursive: true });
await writeFile("samples/Monthly_Plan_Sheet_2026-10_SAMPLE.pdf", await renderMonthlyPlanPdf([data], { sample: true }));
await writeFile("samples/Monthly_Plan_Sheet_2026-10_SAMPLE.xlsx", await renderMonthlyPlanXlsx([data], { sample: true }));
console.log("Generated fixture-only monthly plan sheet samples.");
