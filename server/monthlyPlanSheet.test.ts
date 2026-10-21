import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildMonthlyPlanSheetData } from "./exports/monthlyPlanSheet/buildData";
import { renderMonthlyPlanPdf } from "./exports/monthlyPlanSheet/renderPdf";
import { renderMonthlyPlanXlsx } from "./exports/monthlyPlanSheet/renderXlsx";
import { renderMonthlyPlanTemplate } from "./exports/monthlyPlanSheet/renderTemplate";

const employee = { empCode: "SAMPLE01", employeeName: "Sample Employee", designation: "Territory Manager", department: "Sales" };
const fixture = (month: string) => buildMonthlyPlanSheetData({
  month, generatedAt: new Date("2026-10-01T08:00:00Z"), employee,
  plan: { version: 2, status: "Submitted", submittedAt: new Date("2026-10-01T08:00:00Z") },
  items: [
    { plannedDate: `${month}-05`, customerName: "Example Customer A", location: "Hyderabad", purpose: "New Lead", remarks: "Trial order review", applyForTicket: false },
    { plannedDate: `${month}-05`, customerName: "Example Customer B", location: "Krishna District", purpose: "Follow-up", remarks: "Discuss next steps", applyForTicket: true },
  ],
  holidays: [{ holidayDate: `${month}-02`, name: "Fixture holiday" }],
});

describe("monthly plan sheet data builder", () => {
  it.each([["2026-10", 31], ["2026-02", 28], ["2028-02", 29]] as const)("builds %s with %i dates", (month, count) => {
    const data = fixture(month);
    expect(data.days).toHaveLength(count);
    expect(data.days[0].date).toBe(`${month}-01`);
    expect(data.days.at(-1)?.date).toBe(`${month}-${String(count).padStart(2, "0")}`);
  });
  it("flags Sundays and holiday shading and repeats a date for multiple visits", () => {
    const data = fixture("2026-10");
    expect(data.days.filter(day => day.isSunday).map(day => day.date)).toEqual(["2026-10-04", "2026-10-11", "2026-10-18", "2026-10-25"]);
    expect(data.days[1].isHoliday).toBe(true);
    expect(data.days[4].rows).toHaveLength(2);
    expect(data.days[4].rows.map(row => row.customer)).toEqual(["Example Customer A", "Example Customer B"]);
    expect(data.totals).toEqual({ plannedVisits: 2, distinctCustomers: 2, workingDaysWithPlan: 1, sundaysAndHolidays: 5, tickets: 1 });
  });
  it("keeps a blank day row for hand writing and handles a no-plan employee", () => {
    const data = buildMonthlyPlanSheetData({ month: "2026-10", employee, plan: null, items: [] });
    expect(data.plan).toBeNull();
    expect(data.days.every(day => day.rows.length === 1 && day.rows[0].customer === "")).toBe(true);
    expect(data.totals.plannedVisits).toBe(0);
  });
});

describe("monthly plan sheet renderers", () => {
  it("creates a valid PDF buffer", async () => {
    const pdf = await renderMonthlyPlanPdf([fixture("2026-10")], { sample: true });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
  it("embeds Unicode fallback fonts for Indian-language employee names", async () => {
    const data = buildMonthlyPlanSheetData({ month: "2026-10", employee: { ...employee, employeeName: "अन्या தமிழ்" }, plan: null });
    const pdf = await renderMonthlyPlanPdf([data]);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
  it("creates a workbook with a sheet per employee, dates, image, filter, and print setup", async () => {
    const buffer = await renderMonthlyPlanXlsx([fixture("2026-10")]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet("SAMPLE01");
    expect(sheet).toBeDefined();
    expect(sheet?.getCell("A11").value).toBeInstanceOf(Date);
    expect(sheet?.getImages().length).toBeGreaterThan(0);
    expect(sheet?.autoFilter).toBeTruthy();
    expect(sheet?.pageSetup.fitToWidth).toBe(1);
    expect(sheet?.pageSetup.printTitlesRow).toBe("10:10");
  });
  it("creates a 50-row data-entry template with locked month fields and Instructions/Lists sheets", async () => {
    const buffer = await renderMonthlyPlanTemplate("2026-10", [{ empCode: "SAMPLE01", employeeName: "Sample Employee", designation: "Sales", department: "Field" }]);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet("SAMPLE01");
    expect(sheet?.getCell("A5").value).toBe("Emp Code");
    expect(sheet?.getCell("A6").value).toBe("SAMPLE01");
    expect(sheet?.getCell("C6").value).toBe("2026-10");
    expect(sheet?.getCell("D6").numFmt).toBe("dd-mm-yyyy");
    expect(sheet?.getCell("G6").dataValidation.type).toBe("list");
    expect(sheet?.getCell("A55").value).toBe("SAMPLE01");
    expect(sheet?.pageSetup.printArea).toBe("A1:M55");
    expect(workbook.getWorksheet("Instructions")).toBeDefined();
    expect(workbook.getWorksheet("Lists")?.state).toBe("veryHidden");
  });
});
