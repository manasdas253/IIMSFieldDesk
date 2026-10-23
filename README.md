# FieldDesk — CKA Birla Group (IIMS)

A mobile-first field-operations app for daily customer visit logs, weekly route plans, travel expenses and manager reporting.

## Phase 1 scope

- Daily visit and weekly plan capture with field-blur draft autosave, inline validation, quick log, ticket-request details and success states.
- Overview KPIs and monthly cost trend, plus Today’s Visits, Employee Report, Cost Summary, Plan vs Actual and Upcoming Plan.
- Managed MySQL persistence through Drizzle; visit and plan CRUD/report procedures through tRPC.
- CSV and Excel workbook export on report tables.
- Employee Code and password login backed by scrypt password hashes and signed, HTTP-only 12-hour sessions.
- Employee and administrator roles enforced on every tRPC request and on monthly-plan download routes. Employee data access is scoped to the signed-in Emp Code.
- First-login password changes, rate-limited sign-in, account disablement and administrator credential/role management.

## Development

### Local Windows setup

Install MySQL 8 and create a local database and user. In a MySQL client connected as an administrator, run the following, replacing the example password with the password in the root `.env` file:

```sql
CREATE DATABASE fielddesk_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'fielddesk_local'@'127.0.0.1' IDENTIFIED BY 'FieldDeskLocal2026!';
GRANT ALL PRIVILEGES ON fielddesk_local.* TO 'fielddesk_local'@'127.0.0.1';
```

The local `.env` is ignored by Git and contains a `DATABASE_URL` for this database plus `PORT=3000`. Configure `AUTH_SECRET` with at least 32 random characters. On first startup, set both `BOOTSTRAP_ADMIN_EMPCODE` and `BOOTSTRAP_ADMIN_PASSWORD` (minimum 12 characters); FieldDesk creates or promotes that employee as the initial administrator and requires a password change at first sign-in. Keep bootstrap values secret and remove the password from the runtime environment after bootstrap. Apply the checked-in migrations with `pnpm.cmd db:migrate`, then start the app with `pnpm.cmd dev`. Open `http://localhost:3000`; `/api/health` should return `{"status":"ok"}`. The root `dev`, `start`, and `dev:static` scripts support Windows; `dev:static` honors `PORT` and defaults to 3000.

Administrators add employee records in Employee Directory, then use the key icon to assign a temporary password and role. Password resets require the employee to set a new password. Employees can sign in after an administrator provisions credentials.

```sh
pnpm dev             # development server on PORT (default 3000)
pnpm check           # TypeScript
pnpm test             # unit and integration tests
pnpm build            # production frontend/server build
pnpm db:migrate       # apply checked-in Drizzle migrations
pnpm db:push          # generate and apply additive schema changes
pnpm start            # serve the production build
```

The app uses the configured managed `DATABASE_URL`; do not print or place the DSN in source. The development and published app use the same managed database. Treat schema changes and test writes accordingly; do not seed fake employee activity.

## Architecture and handoff

- UI: `client/src/pages/Home.tsx`, `client/src/components/field-ops/`, `client/src/contexts/CurrentUserContext.tsx`.
- Shared inputs and validation: `shared/fieldOps.ts`.
- Schema: `drizzle/schema.ts`; migrations: `drizzle/`.
- Procedures: `server/routers/fieldOps.ts`; persistence: `server/fieldOpsDb.ts`.
- Product wireframes, database fields, full API procedure list, component map, and future auth integration: [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md).
- Current implementation plan and outcome tracking: [`plan.md`](plan.md), [`TODO.md`](TODO.md).

The unused template `users` table is retained for compatibility; FieldDesk employee sessions use the `employees` table.


## FieldDesk v3 additions

The current branch also contains an Emp Code employee master, required employee-code selection for new daily and weekly submissions, code-scoped browser drafts, monthly plan upload templates with row-by-row validation and error workbooks, employee-month versioned submissions, holiday management, follow-up reminders, monthly plan analysis and print-sheet exports (PDF, Excel and per-employee PDF ZIP), and branded sample outputs. New tables and nullable legacy visit/weekly-plan Emp Code fields are additive in `drizzle/0002_fielddesk_v3.sql`; apply the checked-in migration before using these workflows. Existing historical records are not backfilled or deleted. Add the employee roster before submitting new employee-code-linked records.

For this managed project, the starter `0000_initial_users` migration was already applied; the project owner then approved and the application successfully ran `0001_sudden_jane_foster.sql` followed by `0002_fielddesk_v3.sql`. The FieldDesk visit, weekly-plan, employee, monthly-plan, follow-up, holiday, and push-subscription tables now exist. The change added schema only; no FieldDesk records were seeded or backfilled. Both `pnpm db:migrate` and `pnpm db:push` change the shared managed database, so obtain approval before future schema changes.

The employee-authentication migration is `drizzle/0003_employee_auth.sql`. Apply it with `pnpm.cmd db:migrate` before starting the authenticated application. Sign-in throttling is process-local; deployments with multiple application instances should use a shared rate-limit store. Browser reminders currently work while the app is open and use browser notification permission. Persistent Web Push delivery and the scheduled manager digest require deployment-side credentials/configuration and are not enabled by this change.

Monthly report procedures include `fieldOps.employees.*`, `fieldOps.monthlyPlans.*`, `fieldOps.followUps.*`, `fieldOps.holidays.*`, `fieldOps.reports.monthlyPlan`, and `fieldOps.reports.monthlyPlanSheet`. Binary workbook routes are registered under `/api/exports/monthly-plan-sheet.*`; monthly input-template downloads use `/api/exports/monthly-plan-template.xlsx`. See [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) for schemas, workflow details and known deployment follow-ups.

## Managed Preview

The managed project retains its Dockerfile, `.dockerignore`, health endpoint, public runtime configuration endpoint, and managed runtime settings. Run `pnpm dev` on `PORT` (default 3000); `/api/health` is the readiness endpoint and `client/public/manus-routes.json` declares the app page route. Authentication is enabled in the app runtime; preview setup does not publish a public deployment. Configure the authentication environment variables on every runtime before launch.
