import { router } from "./_core/trpc";
import { fieldOpsRouter } from "./routers/fieldOps";

export const appRouter = router({
  // Phase 1 is deliberately unauthenticated. Add identity-aware routers in a later phase.
  fieldOps: fieldOpsRouter,
});

export type AppRouter = typeof appRouter;
