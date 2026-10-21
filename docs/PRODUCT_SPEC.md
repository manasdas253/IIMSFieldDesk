# CKA Birla Group (IIMS) FieldDesk — Product & technical handoff

## Product intent

FieldDesk is a mobile-first Phase 1 operating desk for field visits, weekly route plans, and travel costs. It is built for CKA Birla Group (IIMS), with separate fast capture for field staff and readable roll-ups for managers. **There is no login, Manus Auth, or authorization in this phase.** Employee names are explicit editable form/report values. The product uses the provisioned managed database for submitted records and browser storage for in-progress drafts.

## Wireframe and page layouts

### App shell

**Desktop:** a narrow fixed left rail contains the route-node FieldDesk mark, CKA Birla Group · IIMS label, workspace label, grouped Workspace / Reports & Insights navigation, and a compact Phase 1 note. A slim sticky top bar shows organization context, active view, India-local date, and a persistent “Log a visit” action. The work area is left-aligned, wide, and built around summary-to-detail sections.

**Phone:** the desktop rail disappears. A compact brand/header remains, the primary action stays at the top, and an always-visible bottom navigation strip provides access to all destinations. Forms use a single column where practical, with large touch targets and horizontally scrollable report tables when necessary.

### Capture: Daily visit log

A page heading (“Make every visit count”) leads to two tab/step controls: Daily visit log and Next week’s plan. The daily form opens with employee and date fields; customer and location; purpose and travel mode; distance and INR travel cost; a short outcome entry with suggested statuses; and optional notes. A Quick log control reveals a recent-customer picker; selecting a customer pre-fills the latest employee, customer, location, purpose, travel mode, distance, and cost values for review/editing. Fields autosave to a local draft on blur. Errors appear adjacent to their fields. A successful save is replaced by a clear confirmation state and a “Log another visit” button.

### Capture: Next week’s plan

The weekly tab begins with employee name and Week Starting date (suggested as the next Monday and validated to remain a Monday for Monday–Sunday reconciliation). Below it, a route-details list lets the employee add one or more planned customer stops, each with customer, location and purpose. Each stop has an Apply for a ticket switch; when enabled, Travel Mode, From, To and Preferred Date appear. Inline errors identify missing values. The same blur-saved, employee-scoped draft behavior protects work in progress, including changes to the planned-stop list. Submission produces a distinct plan confirmation and an option to create another plan.

### Overview

Five KPI cards report total visits today, employees active in the field today, month-to-date travel cost (INR), upcoming weekly plan submissions, and total visits through today. Clicking the cumulative-visits KPI opens a paginated detail view with Date, Employee, Customer, Location, Purpose, Outcome, and Travel cost. A six-month travel-cost area trend sits beside a restrained field-operations note panel. A “Today’s visits” table previews activity, with loading skeletons and an explicit no-visits state when empty.

Directly below Recent Field Activity, a lazily loaded India map reads that same India-local Today’s Visits result only; it introduces no visit data store or schema. MapLibre GL renders purpose-coloured city pins and extruded bars whose height reflects visit count, with grouped employee/customer/purpose/outcome/time popups, a legend, reset and 2D/3D controls, row-to-city camera focus, and pin-to-row selection. It supports touch rotation/zoom and an approximately 400px mobile viewport. The keyless OpenFreeMap style and tiles retain attribution; a same-origin allowlisted asset proxy avoids browser access failures. WebGL/worker failures use a Leaflet.VectorGrid 2D fallback, and a failure of that fallback hides only the map section. Empty visits show “No visits logged today”; unrecognized cities are listed below the map.

### Today’s Visits

The daily log view opens with the India-local date and a filter strip for employee, location/city and purpose. The table shows date, employee, customer, location, purpose, outcome and travel cost. Column headers sort; the report table offers search, pagination, CSV and Excel export.

### Employee Report

A manager first chooses an employee and date range. Three summary tiles show visits, distinct customers and travel cost. A detail table then shows that employee’s visits, customers, location/purpose/outcome and cost. A clear empty selection prompt prevents a blank report.

### Cost Summary

A date-range control drives an employee-by-month breakdown. The table reports employee, month, visit count, total cost, and average cost per visit; a summary at the top shows overall travel spend for the selected range. The table can be searched, sorted, paginated, and exported to CSV or Excel with numeric INR values.

### Plan vs Actual

Date-range and employee filters control a route reconciliation table. Planned rows are matched to logged visits by employee name, normalized customer name and the Monday-to-Sunday plan window. Planned and actual customer/location fields are shown side by side. Statuses are Visited, No-show, and Unplanned; counts summarize exceptions and completed visits. Actual date and outcome appear when matched. No-shows and unplanned visits use textual status badges as well as color.

### Upcoming Plan

The default view is the next Monday-to-Sunday period, with editable date-range and employee filters. A team-wide stop list shows week, employee, planned customer, location, purpose, whether a ticket is requested, and ticket travel mode, route and preferred date. Each report table includes sort/search/pagination and CSV/Excel export.

### Weekly Visits

The report defaults to the current Monday-to-Sunday week and reads only existing Daily Visit Log rows. Employee and Purpose filters apply to the table and its summary of total visits, distance and travel cost; a per-employee visit count is shown, with Excel export of the filtered table.

### All visits through today

Opened from the cumulative-visits Overview KPI, this paginated read-only view lists visits through the India-local current date with Date, Employee, Customer, Location, Purpose, Outcome and Travel cost.

## Database schema

The initialized Drizzle/MySQL schema retains the starter `users` table only as an unused future identity anchor. Phase 1 field records do not reference it and contain no authenticated ownership field.

| Table | Columns | Purpose / relationships |
| --- | --- | --- |
| `field_visits` | `id` (PK), `employeeName`, `visitDate`, `customerName`, `location`, `purpose`, `travelMode`, `distanceKm` DECIMAL(10,2), `travelCost` DECIMAL(12,2), `outcome`, nullable `notes`, `createdAt`, `updatedAt` | One row per daily customer visit. Employee name remains editable text; purpose and travel mode use the requested enumerations. |
| `weekly_plans` | `id` (PK), `employeeName`, `weekStartingDate`, `createdAt`, `updatedAt` | One header per employee/week plan. |
| `planned_visits` | `id` (PK), `planId` (FK → `weekly_plans.id`, cascade delete), `customerName`, `location`, `purpose`, `applyForTicket`, nullable `travelMode`, `routeFrom`, `routeTo`, `preferredDate`, `createdAt` | One row per planned customer stop; ticket fields are populated only when requested. |

Date-only values use MySQL DATE and stay `YYYY-MM-DD` at the API boundary. Travel amounts and distances are decimal values, not display-formatted strings. The browser draft is stored locally and is not a submitted database record.

## API endpoint / procedure list

The application exposes validated tRPC procedures under `/api/trpc`; the procedure path is the endpoint identifier. Read/list and report procedures are queries; mutations create/update/delete rows. Every input is validated before reaching database persistence.

| Procedure | Operation | Inputs / result |
| --- | --- | --- |
| `fieldOps.employees` | Query | Distinct employee names derived from visits and plans for autocomplete/report selection. |
| `fieldOps.visits.list` | Read/list | Optional date range, employee, location, purpose and search filters; returns matching visits. |
| `fieldOps.visits.get` | Read one | `{ id }` → one visit or NOT_FOUND. |
| `fieldOps.visits.recent` | Read recent | Optional bounded `limit` → recent visits for quick-log prefill. |
| `fieldOps.visits.create` | Create | Validated daily visit fields → inserted visit. |
| `fieldOps.visits.update` | Update | `{ id, ...visitFields }` → updated visit. |
| `fieldOps.visits.delete` | Delete | `{ id }` → success. |
| `fieldOps.plans.list` | Read/list | Optional week range and employee → plans with their planned-stop rows. |
| `fieldOps.plans.get` | Read one | `{ id }` → plan and items or NOT_FOUND. |
| `fieldOps.plans.create` | Create | Employee, week start and one-or-more validated stops → plan with item rows. |
| `fieldOps.plans.update` | Update | `{ id, employeeName, weekStartingDate, items[] }`; replaces the plan’s item set transactionally. |
| `fieldOps.plans.delete` | Delete | `{ id }` → plan removed; related planned stops cascade. |
| `fieldOps.reports.overview` | Report query | Returns today’s visit count, active employee count, MTD cost, upcoming weekly-plan header count and six-month spend trend. |
| `fieldOps.reports.allVisitsToDate` | Report query | Paginated visit detail through the India-local current date, with a total count. |
| `fieldOps.reports.employee` | Report query | Required employee and optional dates → visit detail, visit count, distinct customer count and cost total. |
| `fieldOps.reports.costSummary` | Report query | Optional date range/employee → monthly employee totals, visit counts and average cost. |
| `fieldOps.reports.planVsActual` | Report query | Optional date range/employee → planned/actual matched stops and exception statuses. |
| `fieldOps.reports.upcomingPlans` | Report query | Optional date range/employee → plan headers with their stop details. |

The map’s `/api/map-tiles/*` GET route is infrastructure-only: it forwards a strict allowlist of public OpenFreeMap style, vector-tile, sprite and glyph assets. It neither reads nor persists FieldDesk visit/plan records. Weekly Visits reuses `fieldOps.visits.list` with a week range rather than adding a report data store or duplicate records.

## Frontend component breakdown

| Component / module | Responsibility |
| --- | --- |
| `pages/Home.tsx` | App shell, navigation, active view selection and responsive rail/bottom navigation. |
| `components/field-ops/VisitForms.tsx` | Two-section capture flow, daily visit and weekly plan forms, inline validation, quick log and success states. |
| `components/field-ops/Reports.tsx` | Overview KPI/chart panel and Today’s Visits, Employee Report, Cost Summary, Plan vs Actual, Upcoming Plan, Weekly Visits and cumulative-visits detail views. |
| `components/field-ops/DataTable.tsx` | Reusable sort/search/pagination and CSV/Excel exports for report datasets. |
| `components/field-ops/OverviewMapSection.tsx` | Lazy-load boundary, empty state and failure isolation for the Overview map. |
| `components/field-ops/IndiaVisitsMap.tsx`, `indiaMapData.ts` | MapLibre 3D/Leaflet 2D renderers, read-only grouping of today’s visit rows by city, popup content, controls and row/pin interaction. |
| `hooks/useFieldDraft.ts` | Safe local draft read/write/clear behavior; each form calls save on blur. |
| `contexts/CurrentUserContext.tsx`, `lib/currentUser.ts` | Replaceable current-user seam that returns no identity in Phase 1. |
| `lib/trpc.ts` | Typed client transport to the Express/tRPC application. |
| `server/routers/fieldOps.ts` | Input validation and public Phase 1 business procedures. |
| `server/fieldOpsDb.ts` | MySQL/Drizzle reads, writes and transactional weekly-plan updates. |
| `server/_core/mapTileProxy.ts` | Allowlisted, cached same-origin forwarding for public OpenFreeMap map assets only. |

## Authentication and authorization in a later phase

The Phase 1 tRPC context explicitly returns `user: null`; no OAuth routes are registered, no login UI or redirect is active, and field-operations procedures do not rely on identity. To add authentication later, replace the anonymous resolver in `server/_core/context.ts` with a verified session-to-user mapping, provide an implementation for `currentUserService.getCurrentUser()`, and add authentication/authorization middleware around the routers. Then add employee IDs and explicit row ownership/role rules to the schema through an additive migration, and scope reports/CRUD by the resolved identity. Do not change visit form field logic or export/report presentations solely to add the provider.


## FieldDesk v3 implementation addendum

### Employee identity and legacy compatibility

`employees` is the employee master keyed by normalized, unique `empCode`; it holds employee name, designation, department, mobile, active status and timestamps. The code is treated as immutable on edit. New daily visit and weekly-plan submissions require an active employee code and persist the master name snapshot with the nullable `empCode` columns added to existing visit/weekly-plan tables. Existing rows remain unchanged and may have no Emp Code. Draft storage is keyed by employee code where available, with legacy name-keyed drafts still readable. The UI does not offer authentication or role-based access; active/inactive controls are not an authorization boundary.

### Monthly input workbook and upload validation

The input template uses one sheet per selected employee (or all active employees), with 50 data rows beginning at row 6 after the header on row 5. Its 13 columns are Emp Code, Employee Name, Plan Month, Planned Date, Customer Name, Location / City, Purpose, Apply for Ticket, Travel Mode, From, To, Preferred Travel Date and Remarks. Emp Code/name/month identity cells are protected; the purpose/ticket/travel fields use Excel list validation, and Instructions plus a very-hidden Lists worksheet are included. Upload parsing selects only worksheets with the expected row-5 header, skips blank defaults, and submits row numbers and normalized fields to `fieldOps.monthlyPlans.validateUpload`. The server verifies the active Emp Code, master-name match, plan month, required fields, date/calendar range, enumerated values and ticket-dependent fields. It returns valid rows plus field-specific errors and non-blocking duplicate-combination warnings. Errors can be downloaded by workbook row; invalid rows are never included in the submit action. Submission groups rows by employee and replaces a previous employee/month plan as an incremented version after a browser confirmation. Each employee transaction is saved independently, so an infrastructure failure during a multi-employee batch can leave earlier employee sheets saved; the user receives an error toast and should check the report before retrying.

### Monthly plan reporting and print sheets

`fieldOps.reports.monthlyPlan` returns a roster-based monthly summary with `planItems`; `fieldOps.reports.monthlyPlanSheet` produces shared calendar/day-sheet data used by the live preview and PDF/Excel renderers. The analysis workbook is distinct from the employee print workbook: an all-employee analysis file has a summary tab and one detail tab per employee, while a single-employee file has its detail sheet. The printable sheet has one row per calendar date, Sunday and configured company-holiday shading, optional visited state, employee/month/version metadata, counts, signature boxes and generated-time footer. PDFKit writes A4 output; ExcelJS creates the equivalent one-sheet-per-employee workbook and optional all-employee summary. An all-employee ZIP contains individual PDFs. The sample artifacts under `samples/` use fixture-only data and are explicitly marked SAMPLE.

Binary endpoints are `/api/exports/monthly-plan-sheet.pdf`, `/api/exports/monthly-plan-sheet.xlsx`, `/api/exports/monthly-plan-sheet.zip`, and `/api/exports/monthly-plan-template.xlsx`. These routes validate month, orientation, employee selector and rendering options. They are not protected by an auth layer because the project remains in its no-auth phase; deploy only behind an access-controlled network.

### Follow-ups and holiday settings

`follow_ups` stores visit-linked customer, optional Emp Code, date/time, note, status, completion metadata and timestamps. The daily visit form optionally creates a reminder after the visit succeeds; reminder creation is a separate request, so a failure to create a reminder does not roll back the visit. The queue supports employee/status/date filters, mark-done, reschedule and cancel, plus CSV/Excel exports using the shared sortable/searchable `DataTable`. “Log visit” stores a one-time customer/employee prefill and opens the daily form. The shell badge groups overdue, today and next-three-day reminders; Overview has a sixth Follow-ups due KPI. A browser notification may be enabled by the user and is checked while FieldDesk is open; due checks are intentionally not a substitute for persistent push delivery.

`plan_holidays` stores unique holiday dates and labels. The employee/settings screen can add or remove these dates; monthly print-sheet builders shade them alongside Sundays. The existing calendar exceptions and empty-month behavior are covered by fixture tests.

### API additions

- `fieldOps.employees.list/create/update/setActive` — employee master search and lifecycle.
- `fieldOps.monthlyPlans.submit/list/validateUpload` — versioned monthly plans, current monthly items, and non-writing row validation.
- `fieldOps.reports.monthlyPlan/monthlyPlanSheet` — summary/detail report rows and renderer input.
- `fieldOps.followUps.list/create/markDone/reschedule/cancel/dueSummary` — reminder queue and lifecycle.
- `fieldOps.holidays.list/create/delete` — custom plan-sheet holidays.
- Existing legacy employee-name autocomplete remains available to historical/report screens.

### Migration and known operational work

`drizzle/0002_fielddesk_v3.sql` is additive: it adds nullable Emp Code columns/indexes to legacy tables and creates the new employee, monthly plan, follow-up, holiday and push-subscription tables. Migration application is a deployment action and was not run against the managed database during this source-tree change. Existing historical rows are deliberately not backfilled with guessed identities. New capture should wait until the target environment has the schema and a verified roster.

Persistent Web Push is **not enabled**: the schema reserves browser subscription fields, but VAPID key provisioning, subscribe/unsubscribe endpoints, subscription employee ownership, scheduled push dispatch and stale-endpoint cleanup still need to be implemented and tested. The 9 AM IST manager digest is also **not enabled**; it requires a protected scheduled callback, reliable manager recipient configuration and delivery policy. Until those are configured, reminders are visible in the app and browser notifications only while it is open. The full application still lacks authentication/RBAC; do not treat Emp Code selection as access control.
