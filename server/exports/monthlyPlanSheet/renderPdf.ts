import PDFDocument from "pdfkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brandPalette } from "../../../shared/brandPalette";
import type { MonthlyPlanSheetData } from "../../../shared/fieldOps";

const here = path.dirname(fileURLToPath(import.meta.url));
const asset = (name: string) => path.resolve(here, "../../assets", name);
const PAGE_MARGIN = 34;
const columns = ["Date", "Day", "Customer / Party", "Location", "Remarks / Purpose"];
const widthsFor = (landscape: boolean, available: number) => landscape
  ? [78, 76, available * .27, available * .20, available * .31]
  : [57, 62, available * .29, available * .20, available * .31];
const dateText = (value: string) => `${value.slice(8, 10)}-${value.slice(5, 7)}-${value.slice(0, 4)}`;
const monthTitle = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
};

async function optionalImage(doc: PDFKit.PDFDocument, filename: string, x: number, y: number, width: number, height: number) {
  try {
    const buffer = await readFile(asset(filename));
    doc.image(buffer, x, y, { fit: [width, height], align: "center", valign: "center" });
    return true;
  } catch { return false; }
}
export async function renderMonthlyPlanPdf(sheets: MonthlyPlanSheetData[], options: { orientation?: "portrait" | "landscape"; sample?: boolean; includeSundays?: boolean } = {}) {
  if (!sheets.length) throw new Error("No employee sheets to export");
  const orientation = options.orientation ?? "portrait";
  const doc = new PDFDocument({ size: "A4", layout: orientation, margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN }, bufferPages: true, autoFirstPage: false, info: { Title: `Monthly Visit Plan – ${sheets.length === 1 ? sheets[0].employee.empCode : "ALL"} – ${sheets[0].month}`, Author: "FieldDesk", Subject: "Monthly customer visit plan", Keywords: "FieldDesk, monthly plan, CKA Birla Group, IIMS" } });
  const chunks: Buffer[] = [];
  doc.on("data", chunk => chunks.push(Buffer.from(chunk)));
  const fontRegular = path.resolve(here, "../../assets/fonts/DejaVuSans.ttf");
  const fontBold = path.resolve(here, "../../assets/fonts/DejaVuSans-Bold.ttf");
  let regular = "Helvetica";
  let bold = "Helvetica-Bold";
  try { await readFile(fontRegular); regular = "FieldDeskSans"; doc.registerFont(regular, fontRegular); } catch { /* Built-in font fallback. */ }
  try { await readFile(fontBold); bold = "FieldDeskSansBold"; doc.registerFont(bold, fontBold); } catch { /* Built-in font fallback. */ }
  const indicFonts: Array<{ pattern: RegExp; font: string; file: string }> = [
    { pattern: /[\u0980-\u09ff]/, font: "FieldDeskBengali", file: "NotoSansBengali-Regular.ttf" },
    { pattern: /[\u0900-\u097f]/, font: "FieldDeskDevanagari", file: "NotoSansDevanagari-Regular.ttf" },
    { pattern: /[\u0a80-\u0aff]/, font: "FieldDeskGujarati", file: "NotoSansGujarati-Regular.ttf" },
    { pattern: /[\u0a00-\u0a7f]/, font: "FieldDeskGurmukhi", file: "NotoSansGurmukhi-Regular.ttf" },
    { pattern: /[\u0c80-\u0cff]/, font: "FieldDeskKannada", file: "NotoSansKannada-Regular.ttf" },
    { pattern: /[\u0d00-\u0d7f]/, font: "FieldDeskMalayalam", file: "NotoSansMalayalam-Regular.ttf" },
    { pattern: /[\u0b00-\u0b7f]/, font: "FieldDeskOriya", file: "NotoSansOriya-Regular.ttf" },
    { pattern: /[\u0b80-\u0bff]/, font: "FieldDeskTamil", file: "NotoSansTamil-Regular.ttf" },
    { pattern: /[\u0c00-\u0c7f]/, font: "FieldDeskTelugu", file: "NotoSansTelugu-Regular.ttf" },
  ];
  for (const item of indicFonts) { try { const filename = asset(`fonts/${item.file}`); await readFile(filename); doc.registerFont(item.font, filename); } catch { /* Keep the DejaVu Sans fallback if a Noto file is unavailable. */ } }
  const fontFor = (value: string, base: string) => indicFonts.find(item => item.pattern.test(value))?.font ?? base;
  const pageWidth = orientation === "portrait" ? 595.28 : 841.89;
  const pageHeight = orientation === "portrait" ? 841.89 : 595.28;
  const usable = pageWidth - 2 * PAGE_MARGIN;
  const colWidths = widthsFor(orientation === "landscape", usable);
  let pageIndex = 0;
  const newPage = () => { doc.addPage(); pageIndex += 1; return PAGE_MARGIN; };
  const drawHeader = async (data: MonthlyPlanSheetData, continuation = false) => {
    let y = newPage();
    doc.fillColor(brandPalette.primary).rect(PAGE_MARGIN, y, usable, 3).fill();
    doc.fillColor(brandPalette.darkBrand).roundedRect(PAGE_MARGIN + 4, y + 7, 122, 38, 3).fill();
    await optionalImage(doc, "cka-birla-iims-wordmark.png", PAGE_MARGIN + 7, y + 13, 116, 26);
    doc.font(bold).fontSize(15).fillColor(brandPalette.darkBrand).text("MONTHLY VISIT PLAN", PAGE_MARGIN + 126, y + 8, { width: usable - 250, align: "center" });
    doc.font(regular).fontSize(10).fillColor("#555555").text(monthTitle(data.month), PAGE_MARGIN + 126, y + 28, { width: usable - 250, align: "center" });
    doc.font(bold).fontSize(8).fillColor(brandPalette.darkBrand).text("CKA BIRLA GROUP · IIMS", pageWidth - PAGE_MARGIN - 120, y + 14, { width: 120, align: "right" });
    y += 53;
    doc.strokeColor("#D9D9D9").lineWidth(.5);
    const grid = [
      [`Emp Code: ${data.employee.empCode}`, `Employee Name: ${data.employee.name}`],
      [`Designation: ${data.employee.designation || "—"}`, `Department: ${data.employee.department || "—"}`],
      [`Plan Month: ${monthTitle(data.month)}`, data.plan ? `Version ${data.plan.version} · ${data.plan.submittedAt ?? data.plan.status}` : "Draft – not submitted"],
    ];
    const cellW = usable / 2;
    grid.forEach((row, i) => {
      const lineY = y + i * 18;
      doc.roundedRect(PAGE_MARGIN, lineY, usable, 18, 2).stroke();
      doc.font(fontFor(row[0], regular)).fontSize(7.3).fillColor(brandPalette.text).text(row[0], PAGE_MARGIN + 6, lineY + 5, { width: cellW - 10, lineBreak: false, ellipsis: true });
      doc.font(fontFor(row[1], regular)).fontSize(7.3).fillColor(brandPalette.text).text(row[1], PAGE_MARGIN + cellW + 6, lineY + 5, { width: cellW - 10, lineBreak: false, ellipsis: true });
    });
    y += 62;
    if (continuation) doc.font(regular).fontSize(7).fillColor("#666666").text("Continued", PAGE_MARGIN, y - 2);
    return y;
  };
  const drawTableHeader = (y: number) => {
    let x = PAGE_MARGIN;
    doc.fillColor(brandPalette.darkBrand).rect(PAGE_MARGIN, y, usable, 20).fill();
    columns.forEach((label, i) => {
      doc.font(bold).fontSize(7.4).fillColor("#FFFFFF").text(label, x + 4, y + 6, { width: colWidths[i] - 8, lineBreak: false, ellipsis: true });
      x += colWidths[i];
    });
    return y + 20;
  };
  const drawRow = (data: MonthlyPlanSheetData, day: MonthlyPlanSheetData["days"][number], row: MonthlyPlanSheetData["days"][number]["rows"][number], rowIndex: number, y: number) => {
    const values = [dateText(day.date), day.dayName, row.customer, row.location, `${row.purpose}${row.remarks && row.remarks !== row.purpose ? ` · ${row.remarks}` : ""}${row.visited === undefined ? "" : row.visited ? " · Visited" : " · Not visited"}`];
    const font = day.isSunday || day.isHoliday ? bold : regular;
    const textSize = 6.2;
    const padding = 3;
    const heights = values.map((value, i) => doc.font(fontFor(value, font)).fontSize(textSize).heightOfString(value || " ", { width: colWidths[i] - 8, lineGap: 1 }));
    const height = Math.max(day.rows.length === 1 && !row.customer ? 10 : 11, Math.ceil(Math.max(...heights) + padding * 2));
    const isShade = day.isHoliday || (options.includeSundays !== false && day.isSunday);
    const fill = isShade ? "#E5E5E5" : rowIndex % 2 === 1 ? brandPalette.lightTint : "#FFFFFF";
    doc.fillColor(fill).rect(PAGE_MARGIN, y, usable, height).fill();
    doc.strokeColor("#D4D4D4").lineWidth(.35).rect(PAGE_MARGIN, y, usable, height).stroke();
    let x = PAGE_MARGIN;
    values.forEach((value, i) => {
      if (i > 0) doc.moveTo(x, y).lineTo(x, y + height).stroke();
      doc.font(fontFor(value, font)).fontSize(textSize).fillColor(brandPalette.text).text(value, x + 4, y + padding, { width: colWidths[i] - 8, height: height - padding, lineGap: 1, ellipsis: false });
      x += colWidths[i];
    });
    return y + height;
  };
  const drawSignatures = (y: number) => {
    const h = 44;
    const gap = 10;
    const w = (usable - gap * 2) / 3;
    ["Prepared by (employee)", "Reviewed by (manager)", "Approved by"].forEach((label, i) => {
      const x = PAGE_MARGIN + i * (w + gap);
      doc.strokeColor("#BDBDBD").lineWidth(.5).rect(x, y, w, h).stroke();
      doc.font(bold).fontSize(6.5).fillColor(brandPalette.text).text(label, x + 5, y + 4, { width: w - 10 });
      doc.moveTo(x + 5, y + 26).lineTo(x + w - 5, y + 26).stroke();
      doc.font(regular).fontSize(5.8).fillColor("#666666").text("Signature                         Date", x + 5, y + 32, { width: w - 10 });
    });
  };
  if (sheets.length > 1) {
    let y = newPage();
    doc.fillColor(brandPalette.darkBrand).font(bold).fontSize(20).text("MONTHLY VISIT PLAN", PAGE_MARGIN, y + 35);
    doc.font(regular).fontSize(12).fillColor(brandPalette.primary).text(monthTitle(sheets[0].month), PAGE_MARGIN, y + 68);
    doc.font(regular).fontSize(10).fillColor(brandPalette.text).text(`${sheets.length} employees · ${sheets.reduce((sum, s) => sum + s.totals.plannedVisits, 0)} planned visits`, PAGE_MARGIN, y + 96);
    y += 130;
    const missing = sheets.filter(sheet => !sheet.plan).map(sheet => `${sheet.employee.empCode} · ${sheet.employee.name}`);
    doc.font(bold).fontSize(10).fillColor(brandPalette.darkBrand).text("Not submitted", PAGE_MARGIN, y);
    doc.font(regular).fontSize(9).fillColor(brandPalette.text).text(missing.length ? missing.join("\n") : "All listed employees have submitted.", PAGE_MARGIN, y + 18, { width: usable, height: pageHeight - y - 55 });
  }
  for (const data of sheets) {
    let y = await drawHeader(data);
    y = drawTableHeader(y);
    let bandIndex = 0;
    let lastDay = "";
    for (const day of data.days) {
      const sortedRows = day.rows.length ? day.rows : [{ customer: "", location: "", purpose: "", remarks: "" }];
      for (const row of sortedRows) {
        if (y + 30 > pageHeight - PAGE_MARGIN - 5) {
          y = await drawHeader(data, true);
          y = drawTableHeader(y);
        }
        y = drawRow(data, day, row, bandIndex++, y);
      }
      lastDay = day.date;
    }
    if (y + 44 > pageHeight - PAGE_MARGIN) {
      y = await drawHeader(data, true);
      y = drawTableHeader(y);
      doc.font(regular).fontSize(7).fillColor("#666666").text(`End of ${lastDay.slice(0, 7)} plan`, PAGE_MARGIN, y + 4);
      y += 18;
    }
    const t = data.totals;
    doc.fillColor(brandPalette.darkBrand).roundedRect(PAGE_MARGIN, y + 4, usable, 24, 3).fill();
    doc.font(bold).fontSize(7).fillColor("#FFFFFF").text(`Visits ${t.plannedVisits}   ·   Customers ${t.distinctCustomers}   ·   Working days with a plan ${t.workingDaysWithPlan}   ·   Sundays / holidays ${t.sundaysAndHolidays}${t.tickets ? `   ·   Tickets ${t.tickets}` : ""}`, PAGE_MARGIN + 7, y + 12, { width: usable - 14, lineBreak: false, ellipsis: true });
    drawSignatures(y + 33);
  }
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font(regular).fontSize(6.5).fillColor("#666666");
    const label = `Generated by FieldDesk on ${sheets[0].generatedAtIst}${options.sample ? " · SAMPLE" : ""}`;
    const footerY = pageHeight - PAGE_MARGIN - 15;
    doc.text(label, PAGE_MARGIN, footerY, { width: usable * .47, height: 9, lineBreak: false, ellipsis: true });
    doc.text(`Page ${i + 1} of ${range.count}`, PAGE_MARGIN + usable * .47, footerY, { width: usable * .2, height: 9, align: "center", lineBreak: false });
    doc.text("CKA Birla Group · IIMS", PAGE_MARGIN + usable * .68, footerY, { width: usable * .32, height: 9, align: "right", lineBreak: false });
  }
  doc.end();
  await new Promise<void>((resolve, reject) => { doc.once("end", resolve); doc.once("error", reject); });
  return Buffer.concat(chunks);
}
