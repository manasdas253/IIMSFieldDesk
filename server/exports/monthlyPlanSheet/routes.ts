import { ZipArchive } from "archiver";
import type { Express, Request, Response } from "express";
import { monthlyPlanSheetQuerySchema } from "../../../shared/fieldOps";
import { loadMonthlyPlanSheetData } from "./buildData";
import { renderMonthlyPlanPdf } from "./renderPdf";
import { renderMonthlyPlanXlsx } from "./renderXlsx";
import { renderMonthlyPlanTemplate } from "./renderTemplate";
import { listEmployeeMaster } from "../../fieldOpsV3Db";
import { credentialVersion, findActiveEmployee, readSession } from "../../_core/employeeAuth";

function parseQuery(request: Request) {
  return monthlyPlanSheetQuerySchema.parse({
    month: request.query.month,
    empCode: request.query.empCode,
    orientation: request.query.orientation,
    type: request.query.type,
    visited: request.query.visited,
    includeSundays: request.query.includeSundays,
  });
}
function filename(ext: string, month: string, empCode: string) { return `Monthly_Plan_Sheet_${month}_${empCode}.${ext}`; }
function jsonFailure(response: Response, error: unknown) {
  if (response.headersSent) { response.destroy(error instanceof Error ? error : undefined); return; }
  const message = error instanceof Error ? error.message : "Export failed.";
  response.status(400).type("application/json").json({ error: message });
}
async function requireAdmin(req: Request, res: Response) {
  const code = await readSession(req);
  const employee = code ? await findActiveEmployee(code.empCode) : null;
  if (employee?.role === "admin" && !employee.mustChangePassword && employee.passwordHash && credentialVersion(employee.passwordHash, employee.role) === code?.credentialVersion) return true;
  res.status(401).json({ error: "Authentication required." });
  return false;
}
export function registerMonthlyPlanExportRoutes(app: Express) {
  app.get("/api/exports/monthly-plan-template.xlsx", async (req, res) => {
    try {
      if (!await requireAdmin(req, res)) return;
      const month = typeof req.query.month === "string" ? req.query.month : "";
      const empCode = typeof req.query.empCode === "string" ? req.query.empCode : "ALL";
      const validMonth = monthlyPlanSheetQuerySchema.shape.month.parse(month);
      const validCode = monthlyPlanSheetQuerySchema.shape.empCode.parse(empCode);
      const roster = await listEmployeeMaster(false);
      const selected = validCode === "ALL" ? roster : roster.filter(row => row.empCode === validCode);
      if (!selected.length) throw new Error("No active employee matches the selected Emp Code.");
      const xlsx = await renderMonthlyPlanTemplate(validMonth, selected);
      res.status(200).type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").setHeader("Content-Disposition", `attachment; filename=Monthly_Plan_Input_${validMonth}_${validCode}.xlsx`).send(xlsx);
    } catch (error) { jsonFailure(res, error); }
  });
  app.get("/api/exports/monthly-plan-sheet.pdf", async (req, res) => {
    try {
      if (!await requireAdmin(req, res)) return;
      const params = parseQuery(req);
      const sheets = await loadMonthlyPlanSheetData(params.month, params.empCode, { visited: params.visited === "1", blank: params.type === "blank" });
      if (!sheets.length) throw new Error("No employees are available for the selected month.");
      const pdf = await renderMonthlyPlanPdf(sheets, { orientation: params.orientation, includeSundays: params.includeSundays === "1" });
      res.status(200).type("application/pdf").setHeader("Content-Disposition", `attachment; filename=${filename("pdf", params.month, params.empCode)}`).send(pdf);
    } catch (error) { jsonFailure(res, error); }
  });
  app.get("/api/exports/monthly-plan-sheet.xlsx", async (req, res) => {
    try {
      if (!await requireAdmin(req, res)) return;
      const params = parseQuery(req);
      const sheets = await loadMonthlyPlanSheetData(params.month, params.empCode, { visited: params.visited === "1", blank: params.type === "blank" });
      if (!sheets.length) throw new Error("No employees are available for the selected month.");
      const xlsx = await renderMonthlyPlanXlsx(sheets, { orientation: params.orientation, includeSundays: params.includeSundays === "1" });
      res.status(200).type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").setHeader("Content-Disposition", `attachment; filename=${filename("xlsx", params.month, params.empCode)}`).send(xlsx);
    } catch (error) { jsonFailure(res, error); }
  });
  app.get("/api/exports/monthly-plan-sheet.zip", async (req, res) => {
    try {
      if (!await requireAdmin(req, res)) return;
      const params = parseQuery(req);
      if (params.empCode !== "ALL") throw new Error("ZIP export requires empCode=ALL.");
      const sheets = await loadMonthlyPlanSheetData(params.month, "ALL", { visited: params.visited === "1", blank: params.type === "blank" });
      if (!sheets.length) throw new Error("No employees are available for the selected month.");
      res.status(200).type("application/zip").setHeader("Content-Disposition", `attachment; filename=Monthly_Plan_Sheets_${params.month}_ALL.zip`);
      const archive = new ZipArchive({ zlib: { level: 6 } });
      archive.on("error", error => { if (res.headersSent) res.destroy(error); else jsonFailure(res, error); });
      archive.pipe(res);
      for (const sheet of sheets) {
        const pdf = await renderMonthlyPlanPdf([sheet], { orientation: params.orientation, includeSundays: params.includeSundays === "1" });
        archive.append(pdf, { name: `${sheet.employee.empCode}_${params.month}.pdf` });
      }
      await archive.finalize();
    } catch (error) { jsonFailure(res, error); }
  });
}
