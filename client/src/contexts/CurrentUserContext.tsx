import { createContext, useContext, type PropsWithChildren } from "react";
import { trpc } from "@/lib/trpc";

export type CurrentUser = { id: number; empCode: string; employeeName: string; role: "employee" | "admin"; mustChangePassword: boolean };
const CurrentUserContext = createContext<{ user: CurrentUser | null; loading: boolean; refresh: () => Promise<unknown> }>({ user: null, loading: true, refresh: async () => undefined });

export function CurrentUserProvider({ children }: PropsWithChildren) {
  const query = trpc.auth.me.useQuery(undefined, { retry: false, staleTime: 0, refetchInterval: 60_000, refetchOnWindowFocus: true });
  return <CurrentUserContext.Provider value={{ user: query.isError ? null : query.data ?? null, loading: query.isLoading, refresh: query.refetch }}>{children}</CurrentUserContext.Provider>;
}

export function useAuth() { return useContext(CurrentUserContext); }
export function useCurrentUser() { return useAuth().user; }
