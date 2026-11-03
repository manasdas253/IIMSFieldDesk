import cron from "node-cron";
import { runDailyEmailNotifications } from "./dailyEmailService";

let scheduled = false;

export function startDailyEmailScheduler() {
  if (scheduled || process.env.DAILY_EMAIL_ENABLED?.toLowerCase() !== "true") return;
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.warn("[DailyEmail] Scheduler not started: Resend credentials are incomplete.");
    return;
  }
  scheduled = true;
  cron.schedule("0 8 * * *", async () => {
    try {
      const summary = await runDailyEmailNotifications();
      console.info("[DailyEmail] Daily run completed", summary);
    } catch (error) {
      console.error("[DailyEmail] Daily run failed:", error instanceof Error ? error.message : String(error));
    }
  }, { timezone: "Asia/Kolkata", noOverlap: true });
  console.info("[DailyEmail] Scheduler enabled for 08:00 Asia/Kolkata.");
}
