import ExcelJS from "exceljs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brandPalette } from "../../../shared/brandPalette";
import type { MonthlyPlanSheetData } from "../../../shared/fieldOps";

const here = path.dirname(fileURLToPath(import.meta.url));
const wordmark = path.resolve(here, "../../assets/cka-birla-iims-wordmark.png");
const titleMonth = (month: string) => {
  const [year, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, m - 1, 1, 12)));
};
function excelDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}
function validSheetName(name: string, seen: Set<string>) {
  let base = name.replace(/[\\/?*:[\]]/g, "_").slice(0, 31) || "Employee";
  let value = base;
  let suffix = 2;
  while (seen.has(value.toLocaleLowerCase())) {
    const tail = `_${suffix++}`;
    value = `${base.slice(0, 31 - tail.length)}${tail}`;
  }
  seen.add(value.toLocaleLowerCase());
  return value;
}
const thinBorder: Partial<ExcelJS.Borders> = { top: { style: "hair", color: { argb: "FFD2D2D2" } }, left: { style: "hair", color: { argb: "FFD2D2D2" } }, bottom: { style: "hair", color: { argb: "FFD2D2D2" } }, right: { style: "hair", color: { argb: "FFD2D2D2" } } };
const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;

function styleTableHeader(row: ExcelJS.Row) {
  row.height = 23;
  row.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(brandPalette.darkBrand) } }; cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" }, size: 9 }; cell.alignment = { vertical: "middle", wrapText: true }; cell.border = thinBorder; });
}
function styleHeaderBand(sheet: ExcelJS.Worksheet, data: MonthlyPlanSheetData, imageId?: number, sample = false) {
  sheet.mergeCells("A1:B4");
  sheet.mergeCells("C1:E2");
  sheet.mergeCells("C3:E3");
  sheet.mergeCells("C4:E4");
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(brandPalette.darkBrand) } };
  if (imageId !== undefined) sheet.addImage(imageId, { tl: { col: 0.12, row: 0.7 }, ext: { width: 150, height: 18 } });
  sheet.getCell("C1").value = "MONTHLY VISIT PLAN";
  sheet.getCell("C1").font = { name: "Arial", size: 16, bold: true, color: { argb: argb(brandPalette.darkBrand) } };
  sheet.getCell("C1").alignment = { vertical: "middle", horizontal: "center" };
  sheet.getCell("C3").value = titleMonth(data.month);
  sheet.getCell("C3").font = { name: "Arial", size: 11, color: { argb: argb(brandPalette.primary) } };
  sheet.getCell("C3").alignment = { vertical: "middle", horizontal: "center" };
  sheet.getCell("C4").value = sample ? "SAMPLE · CKA Birla Group · IIMS" : "CKA Birla Group · IIMS";
  sheet.getCell("C4").font = { name: "Arial", size: 8, color: { argb: "FF666666" } };
  sheet.getCell("C4").alignment = { vertical: "middle", horizontal: "center" };
  for (let r = 1; r <= 4; r++) {
    sheet.getRow(r).height = r <= 2 ? 23 : 18;
    for (let c = 1; c <= 5; c++) sheet.getCell(r, c).border = { bottom: { style: "thin", color: { argb: argb(brandPalette.primary) } } };
  }
}

export async function renderMonthlyPlanXlsx(sheets: MonthlyPlanSheetData[], options: { orientation?: "portrait" | "landscape"; sample?: boolean; includeSundays?: boolean } = {}) {
  if (!sheets.length) throw new Error("No employee sheets to export");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FieldDesk";
  workbook.title = `Monthly Visit Plan ${sheets[0].month}`;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.properties.date1904 = false;
  let imageId: number | undefined;
  try { imageId = workbook.addImage({ filename: wordmark, extension: "png" }); } catch { imageId = undefined; }
  const seen = new Set<string>();
  if (sheets.length > 1) {
    const summary = workbook.addWorksheet("Summary", { views: [{ state: "frozen", ySplit: 7 }] });
    summary.columns = [{ width: 17 }, { width: 30 }, { width: 18 }, { width: 20 }, { width: 19 }, { width: 20 }, { width: 13 }];
    summary.mergeCells("A1:B2"); summary.mergeCells("C1:G1"); summary.mergeCells("C2:G2"); summary.mergeCells("A3:G3");
    summary.getCell("C1").value = "MONTHLY VISIT PLAN SUMMARY";
    summary.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(brandPalette.darkBrand) } };
    summary.getCell("C1").font = { name: "Arial", size: 16, bold: true, color: { argb: argb(brandPalette.darkBrand) } };
    summary.getCell("C1").alignment = { horizontal: "center", vertical: "middle" };
    summary.getCell("C2").value = `${titleMonth(sheets[0].month)} · CKA Birla Group · IIMS`;
    summary.getCell("C2").alignment = { horizontal: "center", vertical: "middle" };
    if (imageId !== undefined) summary.addImage(imageId, { tl: { col: 0.12, row: 0.2 }, ext: { width: 130, height: 16 } });
    summary.addRow([]); summary.addRow([]); summary.addRow([]);
    const header = summary.addRow(["Emp Code", "Name", "Planned visits", "Distinct customers", "Tickets requested", "Status", "Version"]);
    styleTableHeader(header);
    sheets.forEach(data => summary.addRow([data.employee.empCode, data.employee.name, data.totals.plannedVisits, data.totals.distinctCustomers, data.totals.tickets, data.plan?.status ?? "Not submitted", data.plan?.version ?? 0]));
    summary.autoFilter = { from: "A7", to: `G${summary.rowCount}` };
    summary.pageSetup = { paperSize: 9, orientation: options.orientation ?? "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, margins: { left: .47, right: .47, top: .47, bottom: .47, header: .2, footer: .2 } };
    summary.headerFooter.oddFooter = `&LGenerated by FieldDesk${options.sample ? " · SAMPLE" : ""}&CPage &P of &N&RCKA Birla Group · IIMS`;
    summary.pageSetup.printArea = `A1:G${summary.rowCount}`;
    summary.getColumn(1).alignment = { vertical: "middle" };
  }
  for (const data of sheets) {
    const sheet = workbook.addWorksheet(validSheetName(data.employee.empCode, seen), { views: [{ state: "frozen", ySplit: 9, xSplit: 0 }] });
    sheet.columns = [{ width: 14 }, { width: 13 }, { width: 30 }, { width: 22 }, { width: 42 }];
    styleHeaderBand(sheet, data, imageId, options.sample);
    const info = [
      ["Emp Code", data.employee.empCode, "Employee Name", data.employee.name],
      ["Designation", data.employee.designation || "—", "Department", data.employee.department || "—"],
      ["Plan Month", titleMonth(data.month), "Version / Submitted on", data.plan ? `v${data.plan.version} · ${data.plan.submittedAt ?? data.plan.status}` : "Draft – not submitted"],
    ];
    info.forEach((values, index) => {
      const r = index + 5;
      sheet.mergeCells(r, 2, r, 3); sheet.mergeCells(r, 4, r, 5);
      sheet.getCell(r, 1).value = values[0]; sheet.getCell(r, 2).value = values[1]; sheet.getCell(r, 4).value = values[2]; sheet.getCell(r, 5).value = values[3];
      [1, 2, 4, 5].forEach(c => { const cell = sheet.getCell(r, c); cell.border = thinBorder; cell.alignment = { vertical: "middle", wrapText: true }; cell.font = { name: "Arial", size: 8, bold: c === 1 || c === 4, color: { argb: argb(brandPalette.text) } }; });
      sheet.getRow(r).height = 22;
    });
    sheet.addRow([]); sheet.addRow([]);
    const tableHeader = sheet.addRow(["Date", "Day", "Customer / Party", "Location", "Remarks / Purpose"]);
    const headerRow = tableHeader.number;
    styleTableHeader(tableHeader);
    let dataRowNumber = headerRow + 1;
    let stripe = 0;
    for (const day of data.days) {
      const rows = day.rows.length ? day.rows : [{ customer: "", location: "", purpose: "", remarks: "" }];
      for (const entry of rows) {
        const row = sheet.addRow([excelDate(day.date), day.dayName, entry.customer, entry.location, [entry.purpose, entry.remarks && entry.remarks !== entry.purpose ? entry.remarks : "", entry.visited === undefined ? "" : entry.visited ? "Visited" : "Not visited"].filter(Boolean).join(" · ")]);
        row.height = Math.max(20, Math.min(68, 17 + Math.ceil((String(row.getCell(5).value ?? "").length / 48)) * 11));
        row.eachCell((cell, col) => {
          cell.border = thinBorder;
          cell.alignment = { vertical: "middle", wrapText: col >= 3 };
          cell.font = { name: "Arial", size: 8, bold: day.isSunday || day.isHoliday };
          if (col === 1) cell.numFmt = "dd-mm-yyyy";
          if (day.isHoliday || (options.includeSundays !== false && day.isSunday)) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E5E5" } };
          else if (stripe % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(brandPalette.lightTint) } };
          if (col <= 2) cell.protection = { locked: true };
          else cell.protection = { locked: false };
        });
        stripe++;
        dataRowNumber = row.number;
      }
    }
    const first = headerRow + 1;
    const last = dataRowNumber;
    const totalsRow = last + 2;
    sheet.mergeCells(totalsRow, 1, totalsRow, 2);
    sheet.getCell(totalsRow, 1).value = "Total planned visits";
    sheet.getCell(totalsRow, 3).value = { formula: `COUNTA(C${first}:C${last})`, result: data.totals.plannedVisits };
    sheet.getCell(totalsRow, 4).value = "Distinct customers";
    sheet.getCell(totalsRow, 5).value = { formula: `SUMPRODUCT((C${first}:C${last}<>\"\")/COUNTIF(C${first}:C${last},C${first}:C${last}&\"\"))`, result: data.totals.distinctCustomers };
    sheet.getCell(totalsRow + 1, 1).value = "Working days with a plan";
    sheet.getCell(totalsRow + 1, 2).value = data.totals.workingDaysWithPlan;
    sheet.getCell(totalsRow + 1, 3).value = "Sundays / holidays";
    sheet.getCell(totalsRow + 1, 4).value = data.totals.sundaysAndHolidays;
    sheet.getCell(totalsRow + 1, 5).value = { formula: `COUNTIF(C${first}:C${last},\"<>\")`, result: data.totals.plannedVisits };
    for (let r = totalsRow; r <= totalsRow + 1; r++) for (let c = 1; c <= 5; c++) { const cell = sheet.getCell(r, c); cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(brandPalette.lightTint) } }; cell.font = { name: "Arial", size: 8, bold: true }; cell.border = thinBorder; cell.alignment = { vertical: "middle", wrapText: true }; }
    const signatureRow = totalsRow + 3;
    ["Prepared by (employee)", "Reviewed by (manager)", "Approved by"].forEach((label, i) => {
      const col = 1 + i * 2; sheet.mergeCells(signatureRow, col, signatureRow, col + 1); sheet.getCell(signatureRow, col).value = `${label}\n\n________________________\nSignature / Date`; sheet.getCell(signatureRow, col).alignment = { vertical: "middle", wrapText: true }; sheet.getCell(signatureRow, col).font = { name: "Arial", size: 8 }; sheet.getCell(signatureRow, col).border = thinBorder;
    });
    sheet.getRow(signatureRow).height = 56;
    sheet.autoFilter = { from: `A${headerRow}`, to: `E${last}` };
    sheet.views = [{ state: "frozen", ySplit: headerRow }];
    sheet.pageSetup = { paperSize: 9, orientation: options.orientation ?? "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, margins: { left: .47, right: .47, top: .47, bottom: .47, header: .2, footer: .2 }, printTitlesRow: `${headerRow}:${headerRow}` };
    sheet.headerFooter.oddFooter = `&LGenerated by FieldDesk${options.sample ? " · SAMPLE" : ""}&CPage &P of &N&RCKA Birla Group · IIMS`;
    sheet.pageSetup.printArea = `A1:E${signatureRow}`;
    sheet.protect("", { selectLockedCells: true, selectUnlockedCells: true, formatCells: true, formatColumns: true, formatRows: true, insertRows: true, autoFilter: true, sort: true });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
