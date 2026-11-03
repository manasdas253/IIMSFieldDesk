
# FieldDesk

## Daily employee email notifications

FieldDesk can send one consolidated activity email to each active employee with scheduled visits, visits moved to today, due follow-ups, and overdue pending follow-ups. It uses the existing monthly plan, daily visit status, follow-up, and employee records. Notification history and delivery controls are available to administrators under **Email notifications**.

### Configure

Set these server-side environment variables in the deployment secret store:

```env
RESEND_API_KEY=<Resend API key>
EMAIL_FROM="FieldDesk <notifications@your-verified-domain.com>"
APP_URL=https://fielddesk.example.com
DAILY_EMAIL_ENABLED=false
```

Verify the sender domain in Resend and configure its DNS records before using it. `EMAIL_FROM` must be an address on that verified domain. Keep the API key out of browser environment variables and source control. Start with `DAILY_EMAIL_ENABLED=false`, configure the variables, sign in as an administrator, and send a test message from **Email notifications** to a controlled inbox. After validating delivery and content, set `DAILY_EMAIL_ENABLED=true` and restart the service. The scheduler runs daily at 08:00 in `Asia/Kolkata`.

### Database and deployment

Apply migrations before deploying the updated application:

```sh
pnpm db:migrate
pnpm check
pnpm test
pnpm build
```

Migration `0010_daily_email_notifications.sql` adds the notification audit/idempotency table. Migration `0009_employee_official_work_email.sql` adds the nullable official email column (existing employees remain valid and can be completed in Employee Directory). The unique idempotency key prevents repeated automatic sends for an employee/date; failed attempts can be retried from the administrator history. Manual retries and test messages are stored as separate attempts.

Deploy the built server with `DATABASE_URL`, `AUTH_SECRET`, the Resend settings, and `APP_URL` configured. Keep the scheduler enabled on at least one live server process. Multiple instances are safe for daily sends because the database claims each employee/date once.
