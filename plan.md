# Managed project plan — CKA Birla Group (IIMS) FieldDesk

## Proposed scope and approach

Connect the already completed FieldDesk application to this newly initialized Manus-managed WebDev project. Use the delivered source tree at `/home/ubuntu/fielddesk-work` as the product baseline rather than rebuilding its screens. Preserve the current CKA Birla Group/IIMS brand, supplied wordmark, mobile-first workspace, daily visit and weekly-plan capture, Emp Code directory, monthly plan upload/report/export workflows, holidays, follow-ups, overview, map, reports and fixture-only sample artifacts.

1. **Import the source while preserving the managed project shell.** Transfer the FieldDesk client, shared contracts, server application, tests, documentation, fonts, public assets, sample artifacts and scripts. Retain the managed project’s Git metadata, project initialization/config files, `Dockerfile`, `.dockerignore`, and platform runtime conventions. Confirm the server continues to expose `/api/health`, `/api/platform/config.js`, Express/Vite on `PORT` (default 3000), the map proxy, PDF/XLSX/ZIP export handlers and tRPC at `/api/trpc`. Keep Phase 1 unauthenticated as specified; do not enable login or imply Emp Code is access control.
2. **Align dependencies and build inputs.** Bring across the source manifest, pnpm lockfile, workspace/patch policy and required FieldDesk dependencies (ExcelJS, PDFKit, Archiver, map libraries and their types). Install from the lockfile, then run the project type check, tests and production build. Preserve the managed Dockerfile’s pinned pnpm install, `pnpm build`, `PORT` listener and production entrypoint.
3. **Make schema history reproducible without touching database data.** The managed database was provisioned with the starter `users` baseline migration. FieldDesk’s source includes migration `0001_sudden_jane_foster.sql` for the original visits/plans tables and a hand-written `0002_fielddesk_v3.sql`; the latter is not currently listed in the source Drizzle migration journal. Import the existing schema, migration metadata and SQL, then use Drizzle’s generation workflow to produce/track a canonical v3 migration and snapshot without applying it. Confirm that the managed base migration is recognized and that the pending sequence is only the FieldDesk schema steps. **Do not run migrations until the user explicitly approves the exact pending migrations.** Do not insert fixture or sample records into the managed database.
4. **Run and verify the managed Preview.** Add/retain the static `/manus-routes.json` declaration for the actual app route, start `pnpm dev` on the configured 3000 port, verify the stable WebDev Preview and `/api/health`, and check the application shell. Database-backed views are expected to remain unavailable until the user approves and the pending schema migrations are applied. Keep the project in Preview; do not publish publicly or change auto-publish settings without a separate request.

## Project structure

- `client/src/pages/Home.tsx` and `client/src/components/field-ops/` — app shell, capture forms, employee/monthly-plan/follow-up views, reports and reusable table UI.
- `client/public/` — FieldDesk mark, combined wordmark, service worker and `/manus-routes.json`.
- `shared/fieldOps.ts` and `shared/brandPalette.ts` — shared validation/types and brand colors.
- `server/routers/fieldOps.ts`, `server/fieldOpsDb.ts`, `server/fieldOpsV3Db.ts` — validated tRPC operations and persistence/report queries.
- `server/exports/monthlyPlanSheet/` — shared monthly-sheet data plus PDF, Excel, ZIP and input-template renderers/routes.
- `drizzle/` — MySQL schema, base/FieldDesk SQL migrations, journal and generated snapshots.
- `server/assets/` — logo and embedded fonts used by the PDF renderer.
- `docs/PRODUCT_SPEC.md`, `README.md`, `TODO.md`, `samples/` — handoff documentation and fixture-only sample outputs.
- Root `Dockerfile`, `.dockerignore`, project configuration and `.git/` remain managed-project-owned.

## Design direction

Reuse the delivered FieldDesk visual design and supplied combined CKA Birla Group/IIMS wordmark. Keep the red corporate accent with warm-neutral surfaces, dark readable text, restrained report colors and clear text labels for statuses. Preserve the established responsive left-rail/mobile-navigation layout and the existing form/report interactions; do not introduce a new style system or decorative imagery.

## Build and serving workflow

The managed project uses React/Vite with Express and tRPC, listens on the configured port 3000 through `pnpm dev`, and serves the built client from `dist/public` in production. After source import, run `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, and `pnpm build`. The existing Dockerfile remains the container contract and `/api/health` remains its unauthenticated readiness endpoint. Then launch the resident development process and verify the WebDev Preview. The managed database is project-scoped and supplies runtime `DATABASE_URL`; do not put the DSN in files or the browser bundle.

## Boundaries requiring separate approval

This step is a code import and Preview setup only. The target project has a newly provisioned database with the starter `users` table, no FieldDesk roster or sample data. Applying pending FieldDesk schema migrations will create visit, plan, employee, follow-up, holiday and push-subscription structures; it will not seed records. Ask before running the exact pending migrations. Public publication is also not part of this step. Persistent Web Push and the scheduled 9 AM IST manager digest remain deployment follow-ups, and the app continues to have no authentication or role-based authorization.


## Approved visual refinement — Overview and sidebar

This focused follow-on changes only the left sidebar and Overview presentation. Reuse the existing React components, FieldDesk data, query set, report detail popups, table, exports, and navigation callbacks. The visual changes are confined to `client/src/pages/Home.tsx`, `client/src/components/field-ops/Reports.tsx`, and `client/src/index.css`; `client/index.html` only loads Plus Jakarta Sans for scoped use by the Overview and sidebar. Do not change routes, APIs, query arguments, calculations, other pages, or database state. The existing Overview contract returns an MTD travel-cost total but no employee-level MTD breakdown, so the Travel cost card will retain that total and omit the employee split as explicitly clarified by the user.

### Design direction

- **Design movement:** A crisp enterprise field-operations dashboard with editorial data hierarchy and restrained industrial cues.
- **Core principles:** high-contrast navigation; warm, calm report surfaces; numbers and status labels read at a glance; preserve familiar click behavior.
- **Color philosophy:** warm off-white `#F4F2EE` softens long dashboard sessions; white cards provide clean separation; charcoal `#15171B` anchors the sidebar; corporate red `#D71920` signals navigation and momentum; a restrained green check marks follow-up tracking.
- **Layout paradigm:** keep the sidebar as a fixed desktop rail and preserve the mobile navigation. Use an asymmetric Overview hero; give Travel cost and Follow-ups wider metric spans; pair the trend chart with the dark “Keep the route moving” card; stack “Today by city” before the existing visits table. Collapse to readable two-column metrics and single-column panels at narrow widths.
- **Signature elements:** faint red diagonal speed lines in the hero’s upper-right; a soft-white active navigation surface with a 3px red left bar; compact tinted icon tiles and uppercase metric tags.
- **Interaction philosophy:** visual affordances clarify existing targets only. Retain every existing handler, route, popup, table action, export, and keyboard focus path; add no new action or data dependency.
- **Animation:** retain brief, subtle hover/focus transitions; avoid layout motion and honor `prefers-reduced-motion`.
- **Typography system:** use Plus Jakarta Sans for the Overview and sidebar with a robust system sans-serif fallback; keep metric numerals prominent and labels compact.
- **Brand essence:** a clear, dependable field-operations workspace for CKA Birla Group · IIMS teams; **practical, composed, precise**.
- **Brand voice:** concise and operational. Examples: “A clear view of the field.” and “Keep the route moving.”
- **Wordmark & logo:** reuse the supplied transparent compact IIMS wordmark at approximately 230px wide at the expanded sidebar top, with “FIELDDESK” and “Field operations” beneath; do not redraw or modify the logo asset.
- **Signature brand color:** `#D71920`.

Keep the existing managed server, database, Preview/runtime configuration, and public publishing state unchanged; this is a presentation-only refinement.
