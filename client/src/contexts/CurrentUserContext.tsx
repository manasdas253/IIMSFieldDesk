import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { currentUserService, type CurrentUser } from "@/lib/currentUser";

const CurrentUserContext = createContext<CurrentUser | null>(null);

export function CurrentUserProvider({ children }: PropsWithChildren) {
  const currentUser = useMemo(() => currentUserService.getCurrentUser(), []);
  return <CurrentUserContext.Provider value={currentUser}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
