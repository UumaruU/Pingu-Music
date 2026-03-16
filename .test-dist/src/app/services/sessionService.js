"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionService = void 0;
const tauriBridge_1 = require("./tauriBridge");
const ACCESS_TOKEN_KEY = "access-token";
const REFRESH_TOKEN_KEY = "refresh-token";
const AUTH_USER_KEY = "auth-user";
let accessTokenMemory = null;
let authUserMemory = null;
function parseJson(value) {
    if (!value) {
        return null;
    }
    try {
        return JSON.parse(value);
    }
    catch {
        return null;
    }
}
function decodeJwtPayload(token) {
    const parts = token.split(".");
    if (parts.length < 2) {
        return null;
    }
    try {
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
        const decoded = atob(padded);
        return JSON.parse(decoded);
    }
    catch {
        return null;
    }
}
exports.sessionService = {
    getAccessToken() {
        return accessTokenMemory;
    },
    async loadAccessToken() {
        if (accessTokenMemory) {
            return accessTokenMemory;
        }
        const accessToken = await tauriBridge_1.tauriBridge.readSecureValue(ACCESS_TOKEN_KEY);
        accessTokenMemory = accessToken?.trim() ? accessToken.trim() : null;
        return accessTokenMemory;
    },
    async setAccessToken(accessToken) {
        accessTokenMemory = accessToken?.trim() ? accessToken.trim() : null;
        if (accessTokenMemory) {
            await tauriBridge_1.tauriBridge.saveSecureValue(ACCESS_TOKEN_KEY, accessTokenMemory);
            return;
        }
        await tauriBridge_1.tauriBridge.deleteSecureValue(ACCESS_TOKEN_KEY);
    },
    clearAccessToken() {
        accessTokenMemory = null;
        void tauriBridge_1.tauriBridge.deleteSecureValue(ACCESS_TOKEN_KEY);
    },
    isAccessTokenFresh(accessToken, skewSeconds = 30) {
        if (!accessToken) {
            return false;
        }
        const payload = decodeJwtPayload(accessToken);
        if (!payload?.exp) {
            return false;
        }
        return payload.exp * 1000 > Date.now() + skewSeconds * 1000;
    },
    getCachedUser() {
        return authUserMemory;
    },
    async loadCachedUser() {
        if (authUserMemory) {
            return authUserMemory;
        }
        authUserMemory = parseJson(await tauriBridge_1.tauriBridge.readSecureValue(AUTH_USER_KEY));
        return authUserMemory;
    },
    async setCachedUser(user) {
        authUserMemory = user;
        if (user) {
            await tauriBridge_1.tauriBridge.saveSecureValue(AUTH_USER_KEY, JSON.stringify(user));
            return;
        }
        await tauriBridge_1.tauriBridge.deleteSecureValue(AUTH_USER_KEY);
    },
    clearCachedUser() {
        authUserMemory = null;
        void tauriBridge_1.tauriBridge.deleteSecureValue(AUTH_USER_KEY);
    },
    async getRefreshToken() {
        const refreshToken = await tauriBridge_1.tauriBridge.readSecureValue(REFRESH_TOKEN_KEY);
        return refreshToken?.trim() ? refreshToken.trim() : null;
    },
    async setRefreshToken(refreshToken) {
        if (!refreshToken.trim()) {
            await this.clearRefreshToken();
            return;
        }
        await tauriBridge_1.tauriBridge.saveSecureValue(REFRESH_TOKEN_KEY, refreshToken.trim());
    },
    async clearRefreshToken() {
        await tauriBridge_1.tauriBridge.deleteSecureValue(REFRESH_TOKEN_KEY);
    },
};
