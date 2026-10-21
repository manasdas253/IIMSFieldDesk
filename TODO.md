# TODO — Managed CKA Birla Group (IIMS) FieldDesk

## Visit logging and weekly planning
- [ ] **Daily visit log and weekly plan forms.** Provide a single-page form with two tabbed/stepped sections. Section A is submitted per visit, multiple times a day, and includes Employee Name; Date (defaults to today and is editable); Customer Name; Location / City; Purpose of Visit with exactly New Lead / Follow-up / Service / Collection / Other; Travel Mode with exactly Own Vehicle / Train / Flight / Cab / Other; numeric Distance (km); numeric Travel Cost formatted as INR currency; Visit Outcome as short text or status tags (including examples Positive / Pending / No Response / Closed); optional multiline Notes. Section B is submitted once a week and includes Employee Name; Week Starting Date date picker that auto-suggests next Monday; Planned Customers; Locations / Location; Purpose; Apply for Ticket toggle/checkbox; when checked, show Travel Mode, From–To, and Preferred Date fields. Support multiple planned customer/location/purpose items in a weekly plan. Require the week start to be Monday so plan/actual windows remain consistent.

## Field-staff capture experience
- [ ] **Safe, quick mobile capture.** Auto-save drafts on field blur, scoped per employee to avoid draft bleed; explicitly save before submit and on submission error; and autosave weekly-plan stop additions/removals. Show inline validation on blur and on submit; make the experience mobile-first for field employees using phones; provide “Quick log” mode that minimizes taps for repeat customers by pre-filling from the last visit; show clear success confirmation and a “Log another visit” CTA. Provide skeleton loading and meaningful empty states instead of blank screens. Preserve drafts when validation or submission fails.

## Dashboard shell and daily visit operations
- [ ] **Navigation, KPIs and Today’s Visits.** Build a dashboard shell with left navigation or top tabs for Today’s Visits, Employee Report, Cost Summary, Plan vs Actual, and Upcoming Plan. The overview includes KPI cards for Total visits today, active employees in field, total travel cost (MTD), and pending plans, plus a monthly travel cost trend chart (line or bar). Today’s Visits lists all visits logged today and can be filtered by employee, location, and purpose. Tables support sortable columns, date-range filters, search, and pagination where applicable; use responsive layouts for desktop managers and mobile field staff.

## Employee and cost reporting
- [ ] **Employee Report and Cost Summary.** Employee Report lets a manager select an employee and drill down to all visits, customers, and travel cost within a chosen date range. Cost Summary shows travel cost by employee/month, totals, and averages. Include monthly travel-cost trend visual reporting. Provide CSV and Excel export actions on every report view. Cost values remain INR-formatted and numeric in exported data.

## Plan reporting
- [ ] **Plan vs Actual and Upcoming Plan.** Provide a side-by-side comparison of visits planned in Section B and visits logged in Section A, with planned and actual customer/location columns; flag mismatches and no-shows clearly; show the matched actual date and outcome. Show the next week’s planned visits across all employees in a list and/or calendar view, including requested ticket travel mode, route and preferred date. Support the relevant date-range, employee/location/purpose filters, search, sortable data and pagination.

## Persistent architecture and requested handoff documentation
- [ ] **Persistent CRUD, database schema and API.** Persist submitted daily visits and weekly plans in the managed database. Provide create, read/list, update, and delete operations for visits and plans; provide report queries for dashboard, employee, cost, plan-vs-actual and upcoming-plan views. Keep shared validation and storage logic modular, with a replaceable placeholder currentUser context/service. There is no authentication/authorization in Phase 1; do not require Manus Auth, login or role assignment. Include in project documentation: database schema; API endpoint/procedure list for visit/plan CRUD and reports; and a short note explaining where/how authentication and role-based access can be plugged in later without refactoring core logic.
- [ ] **Wireframe/layout and frontend component breakdown.** Document the layout/wireframe for the visit form and weekly-plan form plus each dashboard view: overview, Today’s Visits, Employee Report, Cost Summary, Plan vs Actual, and Upcoming Plan. Document the frontend component breakdown. Deliver the usable responsive application with loading skeletons and empty states.

## Additive Weekly Visits View
- [ ] **Weekly Visits report, read-only.** Add a new tab or route inside Reports with its own code. Show a week selector defaulting to the current Monday–Sunday week; show all visits logged for that week with Employee, Date, Customer, Location/City, Purpose, Travel Mode, Distance, Travel Cost and Outcome; provide Employee and Purpose filters; show a summary row with total visits, total distance and total travel cost; show per-employee visit counts for the week; and export the filtered table to Excel. Read from existing Daily Visit Log data only; do not create a data store, duplicate records, change schema or existing data, rename/remove/restructure existing tables, fields, API endpoints, routes or components, or modify existing forms and report screens. Test that existing screens, forms, filters, charts and exports remain as before and report tests and any issues found.

## Navigation accessibility
- [ ] **Scrollable sidebar on short viewports.** Keep all left-navigation destinations reachable by scrolling when sidebar content exceeds available viewport height, including Weekly visits under Reports & Insights, without changing existing destination behavior.

## Workspace branding
- [ ] **Company logo in workspace card.** Display the user-supplied CKA Birla Group / IIMS logo in the sidebar card currently labeled “Field operations” and “Internal workspace”; preserve both labels and show the supplied white wordmark on a dark background for contrast.

## Overview card navigation
- [ ] **Weekly Plan shortcut from This Week.** Add a responsive “View weekly plan” button inside the existing “This Week” feature card, linked to the existing Upcoming plan report/list under Reports & Insights. Keep the change additive and ensure no existing functionality, components, or business logic are affected.

## Overview cumulative visits KPI
- [ ] **Total visits through today.** Add a fifth responsive KPI card to “A clear view of the field.” showing the total number of Daily Visit Log visits from all dates through today (inclusive, using the app’s India-local current date). Preserve the four existing KPI values and behavior; keep the count read-only and additive, with no schema change, data duplication, or changes to other functionality, components, or business logic.

## Total visits detail page
- [ ] **Open visit details from the KPI.** Clicking the “Total visits to date” KPI card opens a page showing all visits through today with these details: Date, Employee, Customer, Location, Purpose, Outcome, and Travel cost. Ensure no existing functionality, components, or business logic are affected.

## Additive Overview India map
- [ ] **Lazy 3D city-visit map.** Add a 3D interactive India map on the Overview page, directly below “RECENT FIELD ACTIVITY – Today’s visits”. Use Mapbox GL JS or MapLibre GL with a tilted view, or Globe.gl/Three.js centred on India. Allow rotate, tilt, zoom and pan. Show one 3D pin or glowing bar for each city with a visit today; bar height shows the number of visits. Colour pins/bars by visit purpose and include a small legend. A click or hover must show employee name, customer, purpose, outcome and time; if several employees are in one city, show them all in the popup. Clicking a row in “Today’s visits” flies the camera to its city pin, and clicking a pin highlights its corresponding row(s).
- [ ] **Map controls, fallback, location and empty states.** Provide a “Reset view” button and a 2D/3D toggle, with 2D as fallback. Show “No visits logged today” when there are no visits. List any unmapped city/location below the map. If 3D or WebGL fails, fall back to a 2D map; if the 2D map fails, hide only the map section so the rest of the page keeps working.
- [ ] **Isolation, data source, tiles and mobile layout.** Build the map as a separate component and load it only on this section. Read from existing Daily Visit Log data only; do not change schema or create a data store. Use free tiles or libraries without a paid API key. Make it work on mobile with touch rotate and zoom and a height of about 400px. Make additive changes only: do not modify existing cards, charts, lists, forms, reports or routes except for the required additive row-to-pin and pin-to-row interaction. Keep all existing functionality and business logic intact.
- [ ] **Regression coverage.** After building, test all existing screens and report what was tested and any issue found.

## Overview KPI interactions and visual refinement
- [ ] **KPI detail interactions.** Make all KPI cards in the Overview section clickable, displaying relevant detailed data when clicked.
- [ ] **Overview visual refinement.** Enhance the Overview UI/UX with a modern, professional, visually appealing dashboard, improved layout, spacing, typography, and interactive elements. Do not modify any existing business logic, calculations, data, APIs, or functionalities. Preserve all existing features and ensure everything works correctly.

### Source baseline verification (before managed import)
TypeScript check, all 15 tests, production build, and `git diff --check` passed.
Preview exercised all five KPI click-throughs and each existing form/report screen in read-only mode; desktop and 375px mobile layouts were reviewed. No records were submitted or modified.

## Overview KPI card visual refinement
- [ ] **Premium KPI-card design only.** Redesign the existing KPI cards to look modern, premium, and visually attractive with clean layouts, clear typography, subtle shadows, refined spacing, relevant icons, and smooth hover animations. Improve readability and visual hierarchy while maintaining the existing data, calculations, click actions, responsiveness, business logic, and all other functionalities exactly as they are. Only change the KPI cards’ UI/UX design.

### Source KPI visual verification (before managed import)
- `pnpm check`, all 15 tests, and `pnpm build` passed.
- Preview reviewed at 1280px desktop and 375px mobile; all five KPI click actions still work.
- No records were entered or modified.


## Responsive sidebar UI/UX redesign
- [ ] **Sidebar presentation only.** Redesign the existing sidebar with a modern, premium, and professional enterprise UI. Improve navigation hierarchy, spacing, typography, icons, active menu highlighting, hover effects, and visual consistency. Add smooth expand/collapse animations and ensure the sidebar is fully responsive across desktop, tablet, and mobile devices. Maintain all existing menu items, routes, permissions, navigation behavior, and functionalities exactly as they are. Only improve the sidebar UI/UX without changing any business logic or other parts of the application.


### Source sidebar verification (before managed import)
`pnpm check`, all 15 tests, `pnpm build`, and `git diff --check` passed. Preview verified desktop collapse/expand (252px ↔ 76px), all ten sidebar destinations, Weekly visits navigation from the collapsed rail, and tablet/mobile layouts at 768px and 375px. No records were entered or changed.


## IIMS logo visibility
- [ ] **Responsive IIMS logo.** Ensure the IIMS logo is visible properly in the existing CKA Birla Group/IIMS sidebar branding across desktop, tablet, and mobile layouts.


### Source IIMS logo verification (before managed import)
`pnpm check`, all 15 tests, production build, and `git diff --check` passed. Preview confirmed loaded CKA/IIMS wordmarks at desktop (172×25 and 142×32), plus the IIMS mark in the 768px tablet rail and 375px mobile header. The original combined asset remains intact; no data or navigation behavior was changed.


## FieldDesk v3 additions (this delivery)
- [ ] **Emp Code master and capture identity.** Add the employee directory with active/inactive state, retain history, use active Emp Codes for new daily/weekly capture, and scope local drafts per employee.
- [ ] **Monthly plan input and reporting.** Create 50-row employee-specific/all-employee XLSX templates with locked Emp Code/name/month cells, editable validated fields, Instructions and hidden Lists sheets; validate uploads row by row; return valid rows and specific errors, provide an error-report workbook, and prompt before replacing existing employee-month plans. Provide detailed analysis table/workbook separately from printable PDF/XLSX/ZIP plan sheets.
- [ ] **Monthly plan sheet output.** Add day-by-day month generation, custom holidays and Sunday shading controls, portrait/landscape layout, filled/blank/visited options, brand wordmark, totals, signatures, pagination, Excel formulas/filters/freeze panes and sample fixtures. Keep sample data in memory only.
- [ ] **Follow-up workflow.** Create optional visit-linked reminders, due summary, date/status/employee filters, done/reschedule/cancel actions, CSV/Excel table export, an in-app reminder badge with overdue/today/next-three-day groups, app-open notification, and a prefilled Log visit action.
- [ ] **Documentation and artifacts.** Add migration `0002_fielddesk_v3.sql`, update the product/README docs and provide sample PDF and Excel plan sheets.

### Verification and deployment notes
- `pnpm check` passed; `pnpm test` passed (26 tests across 6 files); `pnpm build` passed. The build reports the existing config.js bundling notice and large map/XLSX chunks.
- Generated the October 2026 sample sheet from fixture data only. PDF is one A4 portrait page; both PDF and Excel-rendered PDF were visually inspected. Excel conversion was performed with LibreOffice; its worksheet print view was one page.
- No database migration was applied and no production records were read, seeded, or changed. The checked-in additive migration must be applied in the target environment before using v3 data workflows.
- **Remaining deployment-dependent:** persistent Web Push via VAPID and the scheduled 9 AM IST manager digest have not been wired. A VAPID key pair, scheduled callback protection/delivery configuration, and manager recipient policy are needed. The phase still has no authentication/RBAC; secure access before broad deployment.


## Managed WebDev integration
- [x] **Import the approved FieldDesk source.** Bring over the complete delivered client, server, shared contracts, schema, migrations, tests, documentation, logo/font assets, scripts and fixture-only sample sheets. Preserve this managed project's Git metadata, initialization config, Dockerfile, .dockerignore and runtime configuration. Keep `/api/health`, `/api/platform/config.js`, the public route manifest, `PORT` binding, tRPC, map proxy and monthly export endpoints working.
- [x] **Install and verify the imported application.** Install the committed pnpm lockfile and workspace policy, then pass `pnpm check`, `pnpm test`, and `pnpm build`; start `pnpm dev` on the configured Preview port and verify the managed Preview and health route. Do not claim report data works before its schema is present.
- [x] **Apply the approved additive schema migrations.** Preserve the already-applied managed `0000_initial_users` baseline; apply `0001_sudden_jane_foster.sql` then `0002_fielddesk_v3.sql` only after explicit approval. The migrations create the original visits/weekly-plan tables and add Emp Code fields plus employee, monthly-plan, follow-up, holiday and push-subscription structures. Do not seed or backfill records.
- [x] **Keep publication separate.** Leave the app in managed Preview; do not publish publicly or enable auto-publish without a separate user request.

### Deferred production tasks
Persistent Web Push delivery and the scheduled 9 AM IST manager digest require deployment configuration and remain outside this source import. The application remains unauthenticated and must be protected at the network/deployment boundary before broad exposure.

Managed import state: the source checklist above records outcomes delivered in the original source project; those outcomes remain unchecked here until imported and verified in this managed project. Original-source verification notes are not proof of managed Preview verification.

### Managed Preview verification
- `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test` (26 tests), `pnpm build`, `pnpm exec drizzle-kit check`, and `git diff --check` passed. The production build retains the existing config-script bundling notice and large map/XLSX chunk warnings.
- The managed server process is running from `/home/ubuntu/fielddesk` on port 3000. `/`, `/api/health`, and `/manus-routes.json` each returned HTTP 200. Verification was limited to these HTTP/health checks; no browser interactions were performed.
- Starter migration `0000_initial_users` was already applied. Following user approval, `pnpm db:migrate` applied `0001_sudden_jane_foster.sql` and generated `0002_fielddesk_v3.sql`; verification found all nine expected FieldDesk tables and three applied Drizzle migrations. No sample records were inserted or backfilled.
- The original report error was HTTP 500 on report/follow-up SQL queries against absent tables. After migration, `fieldOps.reports.overview` returned HTTP 200 with zero-count/empty results, and `/api/health` remains HTTP 200. The project has not been publicly published.

### Responsive action visibility
- [x] **Keep key actions visible without behavior/API changes.** Make the “Log visit” action visible and ensure the long “FIELD CAPTURE / Make every visit count” form’s save button remains visible/reachable while filling it; inspect other responsive button visibility as needed. Do not change any other functionality or any API. Verified the mobile Log visit CTA is visible, primary buttons now have red/white contrast, and the save action uses a sticky mobile footer above navigation. No application logic or API files changed.


### Sidebar brand alignment
- [x] **Make the sidebar IIMS logo look clear and professionally aligned.** Keep the existing CKA Birla Group · IIMS identity, and adjust only its sidebar layout/styling so the IIMS mark is legible at expanded and compact widths. Verified the compact rail at 900px and the full combined wordmark at 1440px; TypeScript, 26 tests, production build, and `git diff --check` pass.


## Approved Overview and sidebar redesign

- [x] **Sidebar presentation.** Restyle only the left sidebar with background `#15171B`. Put the supplied transparent white IIMS logo at the top at about 230px wide, with a small “FIELDDESK / Field operations” label under it. Keep all existing menu items and the “Workspace” and “Reports & Insights” groups in the same order. Give the active item a soft white highlight and a 3px red left bar; use a subtle lighter background on hover. Keep the “Keep the route clear” card and “Phase 1 · No sign-in required” note at the bottom. Keep the redesign responsive without changing navigation behavior.
- [x] **Overview presentation.** Restyle only the Overview page using Plus Jakarta Sans, warm off-white `#F4F2EE`, white cards with 22px corners, and brand red `#D71920`. The header panel retains “OPERATIONS OVERVIEW”, “A clear view of the field.”, the date card, and an accurate overdue status chip; add faint red diagonal speed-lines at its upper right. Preserve all six existing metric values and click targets; add colored icon tiles, TODAY / MTD / WEEKLY / ALL TIME tags, prominent numbers, and “View details” cues. Make Travel cost wider and keep the existing MTD total only; omit the employee split as clarified, with no new API/data fetch. Make Follow-ups wider and add a green check badge. Below the metrics, retain the travel-cost trend chart beside the dark “Keep the route moving” card, then show “Today by city” before the existing “Today’s visits” table.
- [x] **Behavior and scope preservation.** Restyle ONLY the Overview page and left sidebar. Do not change any click, link, route, navigation target, API call, data fetching, query, or calculation. Do not change the “View details” pop-ups, their tables, or CSV/Excel exports. Do not restyle or otherwise change any other page, including Log a visit, Weekly plan, Monthly plan, reports, and Follow-ups. Every existing button, link, and card must do exactly what it does today; keep the same components, handlers, props, and data. Ensure the redesigned presentation works on both web and mobile viewports.


### Approved Overview/sidebar redesign verification
`pnpm check`, `pnpm test` (26 tests), `pnpm build`, and `git diff --check` pass. Preview health and `/manus-routes.json` returned HTTP 200. Desktop (1440px) and mobile (375px) screenshots were inspected; the mobile document fits without horizontal overflow, Plus Jakarta Sans is loaded, and the sidebar/card layouts are intact. The Visits today KPI opens its existing detail popup with CSV/Excel actions; Total visits still opens All visits; Follow-ups still opens Follow-ups; and “View weekly plan” still opens the existing Upcoming plan view. The original Overview tRPC query lines, KPI value/notes/calculation expressions, and click callbacks match the pre-redesign source. No records were submitted or modified. Captures: `/home/ubuntu/fielddesk-preview-screenshots/overview-desktop.png` and `/home/ubuntu/fielddesk-preview-screenshots/overview-mobile.png`.
