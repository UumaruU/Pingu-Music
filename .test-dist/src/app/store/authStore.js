"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAuthStore = void 0;
const zustand_1 = require("zustand");
const apiClient_1 = require("../services/apiClient");
const authService_1 = require("../services/authService");
const sessionService_1 = require("../services/sessionService");
const syncService_1 = require("../services/syncService");
function toAuthError(error) {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }
    return "Не удалось выполнить операцию авторизации.";
}
function buildAuthenticatedState(user, accessToken) {
    return {
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
        status: "authenticated",
    };
}
function buildGuestState(authError = null) {
    return {
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        authError,
        status: authError ? "error" : "guest",
    };
}
exports.useAuthStore = (0, zustand_1.create)()((set, get) => ({
    ...buildGuestState(),
    syncStatus: "idle",
    isRestoring: false,
    hasRestoredSession: false,
    async login(payload) {
        syncService_1.syncService.disableRealtimeSync();
        set({
            isLoading: true,
            authError: null,
            status: "loading",
            syncStatus: "idle",
        });
        try {
            const session = await authService_1.authService.login(payload);
            await sessionService_1.sessionService.setAccessToken(session.tokens.accessToken);
            await sessionService_1.sessionService.setCachedUser(session.user);
            if (session.tokens.refreshToken) {
                await sessionService_1.sessionService.setRefreshToken(session.tokens.refreshToken);
            }
            set({
                ...buildAuthenticatedState(session.user, session.tokens.accessToken),
                syncStatus: "syncing",
            });
            const syncResult = await syncService_1.syncService.syncAfterLogin().catch(() => ({
                status: "error",
                merged: false,
                conflictNames: [],
            }));
            set({
                syncStatus: syncResult.status,
            });
        }
        catch (error) {
            const authError = toAuthError(error);
            sessionService_1.sessionService.clearAccessToken();
            sessionService_1.sessionService.clearCachedUser();
            await sessionService_1.sessionService.clearRefreshToken();
            set({
                ...buildGuestState(authError),
                syncStatus: "error",
            });
            throw error;
        }
    },
    async register(payload) {
        syncService_1.syncService.disableRealtimeSync();
        set({
            isLoading: true,
            authError: null,
            status: "loading",
            syncStatus: "idle",
        });
        try {
            const session = await authService_1.authService.register(payload);
            await sessionService_1.sessionService.setAccessToken(session.tokens.accessToken);
            await sessionService_1.sessionService.setCachedUser(session.user);
            if (session.tokens.refreshToken) {
                await sessionService_1.sessionService.setRefreshToken(session.tokens.refreshToken);
            }
            set({
                ...buildAuthenticatedState(session.user, session.tokens.accessToken),
                syncStatus: "syncing",
            });
            const syncResult = await syncService_1.syncService.syncAfterLogin().catch(() => ({
                status: "error",
                merged: false,
                conflictNames: [],
            }));
            set({
                syncStatus: syncResult.status,
            });
        }
        catch (error) {
            const authError = toAuthError(error);
            sessionService_1.sessionService.clearAccessToken();
            sessionService_1.sessionService.clearCachedUser();
            await sessionService_1.sessionService.clearRefreshToken();
            set({
                ...buildGuestState(authError),
                syncStatus: "error",
            });
            throw error;
        }
    },
    async logout() {
        syncService_1.syncService.disableRealtimeSync();
        const refreshToken = await sessionService_1.sessionService.getRefreshToken();
        try {
            await authService_1.authService.logout(refreshToken ?? undefined);
        }
        catch {
            // ignore logout errors; local cleanup is authoritative
        }
        sessionService_1.sessionService.clearAccessToken();
        sessionService_1.sessionService.clearCachedUser();
        await sessionService_1.sessionService.clearRefreshToken();
        set({
            ...buildGuestState(),
            syncStatus: "idle",
        });
    },
    async restoreSession() {
        if (get().isRestoring) {
            return;
        }
        syncService_1.syncService.disableRealtimeSync();
        set({
            isRestoring: true,
            isLoading: true,
            authError: null,
            status: "loading",
            syncStatus: "idle",
        });
        try {
            const [storedAccessToken, storedUser, refreshToken] = await Promise.all([
                sessionService_1.sessionService.loadAccessToken(),
                sessionService_1.sessionService.loadCachedUser(),
                sessionService_1.sessionService.getRefreshToken(),
            ]);
            if (storedAccessToken && sessionService_1.sessionService.isAccessTokenFresh(storedAccessToken)) {
                const profile = storedUser ?? (await authService_1.authService.me());
                await sessionService_1.sessionService.setCachedUser(profile);
                set({
                    ...buildAuthenticatedState(profile, storedAccessToken),
                    hasRestoredSession: true,
                    isRestoring: false,
                    syncStatus: "syncing",
                });
                const syncResult = await syncService_1.syncService.syncAfterLogin().catch(() => ({
                    status: "error",
                    merged: false,
                    conflictNames: [],
                }));
                set({
                    syncStatus: syncResult.status,
                });
                return;
            }
            if (!refreshToken) {
                sessionService_1.sessionService.clearAccessToken();
                sessionService_1.sessionService.clearCachedUser();
                set({
                    ...buildGuestState(),
                    hasRestoredSession: true,
                    isRestoring: false,
                });
                return;
            }
            const refreshedTokens = await authService_1.authService.refresh(refreshToken);
            await sessionService_1.sessionService.setAccessToken(refreshedTokens.accessToken);
            if (refreshedTokens.refreshToken) {
                await sessionService_1.sessionService.setRefreshToken(refreshedTokens.refreshToken);
            }
            const profile = await authService_1.authService.me();
            await sessionService_1.sessionService.setCachedUser(profile);
            set({
                ...buildAuthenticatedState(profile, refreshedTokens.accessToken),
                hasRestoredSession: true,
                isRestoring: false,
                syncStatus: "syncing",
            });
            const syncResult = await syncService_1.syncService.syncAfterLogin().catch(() => ({
                status: "error",
                merged: false,
                conflictNames: [],
            }));
            set({
                syncStatus: syncResult.status,
            });
        }
        catch {
            sessionService_1.sessionService.clearAccessToken();
            sessionService_1.sessionService.clearCachedUser();
            await sessionService_1.sessionService.clearRefreshToken();
            set({
                ...buildGuestState(),
                hasRestoredSession: true,
                isRestoring: false,
            });
        }
    },
    async refreshSession() {
        const refreshToken = await sessionService_1.sessionService.getRefreshToken();
        if (!refreshToken) {
            syncService_1.syncService.disableRealtimeSync();
            sessionService_1.sessionService.clearAccessToken();
            sessionService_1.sessionService.clearCachedUser();
            set({
                ...buildGuestState(),
            });
            return null;
        }
        try {
            const refreshedTokens = await authService_1.authService.refresh(refreshToken);
            await sessionService_1.sessionService.setAccessToken(refreshedTokens.accessToken);
            if (refreshedTokens.refreshToken) {
                await sessionService_1.sessionService.setRefreshToken(refreshedTokens.refreshToken);
            }
            set((state) => ({
                ...state,
                accessToken: refreshedTokens.accessToken,
                isAuthenticated: true,
                status: "authenticated",
                authError: null,
            }));
            return refreshedTokens.accessToken;
        }
        catch {
            syncService_1.syncService.disableRealtimeSync();
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
        syncService_1.syncService.disableRealtimeSync();
        sessionService_1.sessionService.clearAccessToken();
        sessionService_1.sessionService.clearCachedUser();
        void sessionService_1.sessionService.clearRefreshToken();
        set({
            ...buildGuestState(),
            syncStatus: "idle",
        });
    },
}));
apiClient_1.apiClient.setRefreshHandler(async () => exports.useAuthStore.getState().refreshSession());
