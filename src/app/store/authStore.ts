import { create } from "zustand";
import { AuthState, AuthUser, AuthStatus, SyncStatus } from "../types";
import { apiClient } from "../services/apiClient";
import { authService } from "../services/authService";
import { sessionService } from "../services/sessionService";
import { syncService } from "../services/syncService";

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload extends LoginPayload {
  name?: string;
}

interface AuthStoreState extends AuthState {
  syncStatus: SyncStatus;
  isRestoring: boolean;
  hasRestoredSession: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
  setAuthState: (payload: Partial<AuthState>) => void;
  clearAuthState: () => void;
}

function toAuthError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Не удалось выполнить операцию авторизации.";
}

function buildAuthenticatedState(user: AuthUser, accessToken: string) {
  return {
    user,
    accessToken,
    isAuthenticated: true,
    isLoading: false,
    authError: null,
    status: "authenticated" as AuthStatus,
  };
}

function buildGuestState(authError: string | null = null) {
  return {
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: false,
    authError,
    status: authError ? ("error" as AuthStatus) : ("guest" as AuthStatus),
  };
}

export const useAuthStore = create<AuthStoreState>()((set, get) => ({
  ...buildGuestState(),
  syncStatus: "idle",
  isRestoring: false,
  hasRestoredSession: false,

  async login(payload) {
    syncService.disableRealtimeSync();
    set({
      isLoading: true,
      authError: null,
      status: "loading",
      syncStatus: "idle",
    });

    try {
      const session = await authService.login(payload);
      sessionService.setAccessToken(session.tokens.accessToken);

      if (session.tokens.refreshToken) {
        await sessionService.setRefreshToken(session.tokens.refreshToken);
      }

      set({
        ...buildAuthenticatedState(session.user, session.tokens.accessToken),
        syncStatus: "syncing",
      });

      const syncResult = await syncService.syncAfterLogin().catch(() => ({
        status: "error" as SyncStatus,
        merged: false,
        conflictNames: [],
      }));

      set({
        syncStatus: syncResult.status,
      });
    } catch (error) {
      const authError = toAuthError(error);
      sessionService.clearAccessToken();
      await sessionService.clearRefreshToken();
      set({
        ...buildGuestState(authError),
        syncStatus: "error",
      });
      throw error;
    }
  },

  async register(payload) {
    syncService.disableRealtimeSync();
    set({
      isLoading: true,
      authError: null,
      status: "loading",
      syncStatus: "idle",
    });

    try {
      const session = await authService.register(payload);
      sessionService.setAccessToken(session.tokens.accessToken);

      if (session.tokens.refreshToken) {
        await sessionService.setRefreshToken(session.tokens.refreshToken);
      }

      set({
        ...buildAuthenticatedState(session.user, session.tokens.accessToken),
        syncStatus: "syncing",
      });

      const syncResult = await syncService.syncAfterLogin().catch(() => ({
        status: "error" as SyncStatus,
        merged: false,
        conflictNames: [],
      }));

      set({
        syncStatus: syncResult.status,
      });
    } catch (error) {
      const authError = toAuthError(error);
      sessionService.clearAccessToken();
      await sessionService.clearRefreshToken();
      set({
        ...buildGuestState(authError),
        syncStatus: "error",
      });
      throw error;
    }
  },

  async logout() {
    syncService.disableRealtimeSync();
    const refreshToken = await sessionService.getRefreshToken();

    try {
      await authService.logout(refreshToken ?? undefined);
    } catch {
      // ignore logout errors; local cleanup is authoritative
    }

    sessionService.clearAccessToken();
    await sessionService.clearRefreshToken();
    set({
      ...buildGuestState(),
      syncStatus: "idle",
    });
  },

  async restoreSession() {
    if (get().isRestoring) {
      return;
    }

    syncService.disableRealtimeSync();
    set({
      isRestoring: true,
      isLoading: true,
      authError: null,
      status: "loading",
      syncStatus: "idle",
    });

    try {
      const refreshToken = await sessionService.getRefreshToken();

      if (!refreshToken) {
        set({
          ...buildGuestState(),
          hasRestoredSession: true,
          isRestoring: false,
        });
        return;
      }

      const refreshedTokens = await authService.refresh(refreshToken);
      sessionService.setAccessToken(refreshedTokens.accessToken);

      if (refreshedTokens.refreshToken) {
        await sessionService.setRefreshToken(refreshedTokens.refreshToken);
      }

      const profile = await authService.me();

      set({
        ...buildAuthenticatedState(profile, refreshedTokens.accessToken),
        hasRestoredSession: true,
        isRestoring: false,
        syncStatus: "syncing",
      });

      const syncResult = await syncService.syncAfterLogin().catch(() => ({
        status: "error" as SyncStatus,
        merged: false,
        conflictNames: [],
      }));

      set({
        syncStatus: syncResult.status,
      });
    } catch {
      sessionService.clearAccessToken();
      await sessionService.clearRefreshToken();
      set({
        ...buildGuestState(),
        hasRestoredSession: true,
        isRestoring: false,
      });
    }
  },

  async refreshSession() {
    const refreshToken = await sessionService.getRefreshToken();

    if (!refreshToken) {
      syncService.disableRealtimeSync();
      sessionService.clearAccessToken();
      set({
        ...buildGuestState(),
      });
      return null;
    }

    try {
      const refreshedTokens = await authService.refresh(refreshToken);
      sessionService.setAccessToken(refreshedTokens.accessToken);

      if (refreshedTokens.refreshToken) {
        await sessionService.setRefreshToken(refreshedTokens.refreshToken);
      }

      set((state) => ({
        ...state,
        accessToken: refreshedTokens.accessToken,
        isAuthenticated: true,
        status: "authenticated",
        authError: null,
      }));

      return refreshedTokens.accessToken;
    } catch {
      syncService.disableRealtimeSync();
      await get().logout();
      return null;
    }
  },

  setAuthState(payload) {
    set((state) => ({
      ...state,
      ...payload,
    }));
  },

  clearAuthState() {
    syncService.disableRealtimeSync();
    sessionService.clearAccessToken();
    void sessionService.clearRefreshToken();
    set({
      ...buildGuestState(),
      syncStatus: "idle",
    });
  },
}));

apiClient.setRefreshHandler(async () => useAuthStore.getState().refreshSession());
