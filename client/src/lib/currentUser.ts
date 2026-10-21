export type CurrentUser = { id?: string; displayName?: string | null };

export interface CurrentUserService {
  getCurrentUser(): CurrentUser | null;
}

/** Phase 1 has no login; replace this adapter when an identity provider is introduced. */
export const currentUserService: CurrentUserService = {
  getCurrentUser: () => null,
};
