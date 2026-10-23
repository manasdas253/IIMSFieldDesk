import { router } from "./_core/trpc";
import { fieldOpsRouter } from "./routers/fieldOps";
import { authRouter } from "./routers/auth";

export const appRouter = router({
  auth: authRouter,
  fieldOps: fieldOpsRouter,
});

export type AppRouter = typeof appRouter;
