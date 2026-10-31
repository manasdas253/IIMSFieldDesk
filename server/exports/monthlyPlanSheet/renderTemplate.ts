import ExcelJS from "exceljs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brandPalette } from "../../../shared/brandPalette";
import { TRAVEL_MODES, VISIT_PURPOSES } from "../../../shared/fieldOps";
import type { MonthlyPlanItemInput } from "../../../shared/fieldOps";
import type { SheetEmployee } from "./buildData";

const here = path.dirname(fileURLToPath(import.meta.url));
const imagePath = path.resolve(here, "../../assets/cka-birla-iims-wordmark.png");
const monthTitle = (month: string) => { const [year, m] = month.split("-").map(Number); return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, m - 1, 1, 12))); };
const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;
function sheetName(code: string, used: Set<string>) { let name = code.replace(/[\\/?*:[\]]/g, "_").slice(0, 31) || "Employee"; let base=name,n=2; while(used.has(name.toLowerCase())) name=`${base.slice(0,27)}_${n++}`; used.add(name.toLowerCase()); return name; }

export async function renderMonthlyPlanTemplate(month: string, roster: SheetEmployee[], holidays: string[] = [], change?: { today: string; planVersion: number; items: MonthlyPlanItemInput[]; answeredDates?: string[] }) {
  const workbook = new ExcelJS.Workbook(); workbook.creator = "FieldDesk"; workbook.title = `Monthly Plan Input Template ${month}`; workbook.subject = "Fill the monthly visit plan and upload it to FieldDesk";
  const instructions = workbook.addWorksheet("Instructions");
  instructions.columns = [{ width: 28 }, { width: 96 }];
  instructions.mergeCells("A1:B1"); instructions.getCell("A1").value = "FIELD DESK · MONTHLY VISIT PLAN"; instructions.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FFFFFFFF" } }; instructions.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(brandPalette.darkBrand) } }; instructions.getCell("A1").alignment = { vertical: "middle" }; instructions.getRow(1).height = 30;
  [["1. Select a sheet", "Use the worksheet named with the employee Emp Code. For All employees, complete each employee worksheet you need."], ["2. Keep identity fields", "Emp Code and Employee Name are pre-filled and locked. Do not copy or rename sheets."], ["3. One entry per working day", "Enter a customer visit, No Visit, Office, or Leave for every working day. Leave Sundays and configured company holidays blank."], ["4. Dates", "Plan Date is pre-filled for each working day in MM-DD-YY format. Day is calculated automatically. Preferred Travel Date must also be a real date in the selected month. Format: MM-DD-YY."], ["5. Required fields", "For customer visits, Customer Name, Location / City, and Purpose are required. No Visit, Office, and Leave need only a Planned Date."], ["6. Tickets", "If Apply for Ticket is Yes, select a Travel Mode and complete From, To, and Preferred Travel Date."], ["7. Upload", "Save as .xlsx and upload the completed workbook in FieldDesk → Monthly plan. The app checks every row before submission and lists missing dates."]].forEach((row, index) => { const r = instructions.addRow(row); r.height = 39; r.eachCell(cell => { cell.alignment = { vertical: "middle", wrapText: true }; cell.border = { bottom: { style: "thin", color: { argb: "FFD9D9D9" } } }; }); r.getCell(1).font = { name: "Arial", size: 10, bold: true, color: { argb: argb(brandPalette.darkBrand) } }; r.getCell(2).font = { name: "Arial", size: 10, color: { argb: "FF222222" } }; });
  const lists = workbook.addWorksheet("Lists"); lists.getCell("A1").value = "Purpose"; lists.getCell("B1").value = "Ticket"; lists.getCell("C1").value = "Travel Mode";
  VISIT_PURPOSES.forEach((value, index) => { lists.getCell(`A${index + 2}`).value = value; }); ["Yes", "No"].forEach((value, index) => { lists.getCell(`B${index + 2}`).value = value; }); TRAVEL_MODES.forEach((value, index) => { lists.getCell(`C${index + 2}`).value = value; }); lists.state = "veryHidden";
  let imageId: number | undefined; try { imageId = workbook.addImage({ filename: imagePath, extension: "png" }); } catch { imageId = undefined; }
  const used = new Set<string>();
  const employees = roster.length ? roster : [{ empCode: "", employeeName: "", designation: "", department: "" }];
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const holidayDates = new Set(holidays);
  const answerDates = new Set(change?.answeredDates ?? []);
  const workingDates = Array.from({ length: daysInMonth }, (_, index) => index + 1)
    .map(day => new Date(Date.UTC(year, monthNumber - 1, day)))
    .filter(date => date.getUTCDay() !== 0 && !holidayDates.has(date.toISOString().slice(0, 10)));
  if (change) {
    const metadata = workbook.addWorksheet("_FieldDeskMetadata");
    metadata.getCell("A1").value = "Template Type"; metadata.getCell("B1").value = "change";
    metadata.getCell("A2").value = "Downloaded On"; metadata.getCell("B2").value = change.today;
    metadata.getCell("A3").value = "Base Plan Version"; metadata.getCell("B3").value = change.planVersion;
    metadata.state = "veryHidden";
  }
  for (const employee of employees) {
    const sheet = workbook.addWorksheet(sheetName(employee.empCode || "Employee", used));
    sheet.columns = [{ width: 15 }, { width: 23 }, { width: 16 }, { width: 15 }, { width: 28 }, { width: 22 }, { width: 19 }, { width: 17 }, { width: 18 }, { width: 23 }, { width: 20 }, { width: 18 }, { width: 42 }];
    sheet.mergeCells("A1:B2"); sheet.mergeCells("C1:M1"); sheet.mergeCells("C2:M2"); sheet.mergeCells("A3:M3"); sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(brandPalette.darkBrand) } };
    sheet.getCell("C1").value = "MONTHLY VISIT PLAN INPUT TEMPLATE"; sheet.getCell("C1").font = { name: "Arial", size: 16, bold: true, color: { argb: argb(brandPalette.darkBrand) } }; sheet.getCell("C1").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell("C2").value = `${monthTitle(month)} · Emp Code ${employee.empCode || "(required)"} · Employee ${employee.employeeName || "(select a master record)"}`; sheet.getCell("C2").font = { name: "Arial", size: 10, color: { argb: argb(brandPalette.primary) } }; sheet.getCell("C2").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell("A3").value = change ? `Rows before ${change.today} are locked. Update today and future working days.` : "Enter one visit, No Visit, Office, or Leave for every working day. Day is calculated automatically. Keep identity fields unchanged."; sheet.getCell("A3").font = { name: "Arial", size: 9, italic: true, color: { argb: "FF555555" } }; sheet.getCell("A3").alignment = { wrapText: true };
    sheet.getRow(1).height = 25; sheet.getRow(2).height = 22;
    if (imageId !== undefined) sheet.addImage(imageId, { tl: { col: 0.12, row: 0.32 }, ext: { width: 130, height: 16 } });
    sheet.addRow([]);
    const headers = ["Emp Code", "Employee Name", "Plan Date", "Day", "Customer Name", "Location / City", "Purpose", "Apply for Ticket", "Travel Mode", "From", "To", "Preferred Travel Date", "Remarks"];
    const header = sheet.addRow(headers); header.height = 31;
    header.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(brandPalette.darkBrand) } }; cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { vertical: "middle", wrapText: true }; });
    const itemsByDate = new Map<string, MonthlyPlanItemInput[]>();
    for (const item of change?.items ?? []) itemsByDate.set(item.plannedDate, [...(itemsByDate.get(item.plannedDate) ?? []), item]);
    const changeRows: Array<{ date: string; item: MonthlyPlanItemInput | null; locked: boolean }> = change ? workingDates.flatMap((day): Array<{ date: string; item: MonthlyPlanItemInput | null; locked: boolean }> => {
      const date = day.toISOString().slice(0, 10);
      const locked = date < change.today || answerDates.has(date);
      if (locked) return (itemsByDate.get(date) ?? []).map(item => ({ date, item, locked: true }));
      return [{ date, item: null, locked: false }];
    }) : [];
    const templateRowCount = change ? Math.max(50, changeRows.length) : 50;
    for (let i = 0; i < templateRowCount; i++) {
      const changeRow = change ? changeRows[i] : undefined;
      const item = changeRow?.item;
      const row = sheet.addRow([employee.empCode, employee.employeeName, changeRow ? new Date(`${changeRow.date}T00:00:00Z`) : workingDates[i] ?? null, { formula: `IF(C${i + 6}=\"\",\"\",TEXT(C${i + 6},\"dddd\"))` }, item?.customerName ?? null, item?.location ?? null, item?.purpose ?? null, item ? item.applyForTicket ? "Yes" : "No" : change ? null : "No", item?.travelMode ?? null, item?.routeFrom ?? null, item?.routeTo ?? null, item?.preferredDate ? new Date(`${item.preferredDate}T00:00:00Z`) : null, item?.remarks ?? null]);
      row.height = 21;
      row.eachCell({ includeEmpty: true }, (cell, col) => { cell.border = { bottom: { style: "hair", color: { argb: "FFD6D6D6" } } }; cell.font = { name: "Arial", size: 9, color: { argb: changeRow?.locked ? "FF777777" : "FF222222" } }; cell.alignment = { vertical: "middle", wrapText: col >= 5 }; if (changeRow?.locked) { cell.protection = { locked: true }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E5E5" } }; } else if (col === 1 || col === 2 || col === 4 || (change && col === 3)) cell.protection = { locked: true }; else cell.protection = { locked: false }; if (!changeRow?.locked && (col === 3 || col === 12)) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7E6" } }; });
      row.getCell(3).numFmt = "mm-dd-yy"; row.getCell(12).numFmt = "mm-dd-yy";
      row.getCell(7).dataValidation = { type: "list", allowBlank: true, formulae: [`"${VISIT_PURPOSES.join(",")}"`] };
      row.getCell(8).dataValidation = { type: "list", allowBlank: true, formulae: ['"Yes,No"'] };
      row.getCell(9).dataValidation = { type: "list", allowBlank: true, formulae: [`"${TRAVEL_MODES.join(",")}"`] };
    }
    const lastRow = templateRowCount + 5;
    sheet.autoFilter = { from: "A5", to: `M${lastRow}` }; sheet.views = [{ state: "frozen", ySplit: 5 }];
    sheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "5:5", margins: { left: .3, right: .3, top: .4, bottom: .4, header: .15, footer: .15 } }; sheet.pageSetup.printArea = `A1:M${lastRow}`; sheet.headerFooter.oddFooter = "&LFieldDesk monthly-plan input template&CPage &P of &N&RCKA Birla Group · IIMS";
    await sheet.protect("", { selectLockedCells: true, selectUnlockedCells: true, autoFilter: true, sort: true });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
