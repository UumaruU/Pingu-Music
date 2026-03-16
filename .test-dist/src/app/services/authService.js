"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const apiClient_1 = require("./apiClient");
const userService_1 = require("./userService");
function asRecord(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    return value;
}
function unwrapPayload(payload) {
    const record = asRecord(payload);
    if (!record) {
        return null;
    }
    const nestedData = asRecord(record.data);
    if (nestedData) {
        return nestedData;
    }
    return record;
}
function readString(record, keys) {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return undefined;
}
function normalizeAuthTokens(payload) {
    const root = unwrapPayload(payload);
    if (!root) {
        return null;
    }
    const tokensRecord = asRecord(root.tokens);
    const source = tokensRecord ?? root;
    const accessToken = readString(source, ["accessToken", "access_token", "token"]);
    if (!accessToken) {
        return null;
    }
    return {
        accessToken,
        refreshToken: readString(source, ["refreshToken", "refresh_token"]),
        expiresAt: readString(source, ["expiresAt", "expires_at"]),
    };
}
function normalizeAuthSession(payload) {
    const user = (0, userService_1.normalizeAuthUser)(payload);
    const tokens = normalizeAuthTokens(payload);
    if (!user || !tokens) {
        return null;
    }
    return { user, tokens };
}
function ensureAuthSession(payload, errorMessage) {
    const session = normalizeAuthSession(payload);
    if (!session) {
        throw new Error(errorMessage);
    }
    return session;
}
function ensureAuthTokens(payload, errorMessage) {
    const tokens = normalizeAuthTokens(payload);
    if (!tokens) {
        throw new Error(errorMessage);
    }
    return tokens;
}
exports.authService = {
    async register(payload) {
        const response = await apiClient_1.apiClient.request("/auth/register", {
            method: "POST",
            auth: false,
            skipRefresh: true,
            body: payload,
        });
        const session = normalizeAuthSession(response);
        if (session) {
            return session;
        }
        return this.login({
            login: payload.login,
            password: payload.password,
        });
    },
    async login(payload) {
        const response = await apiClient_1.apiClient.request("/auth/login", {
            method: "POST",
            auth: false,
            skipRefresh: true,
            body: payload,
        });
        return ensureAuthSession(response, "Сервер не вернул корректные данные сессии при входе.");
    },
    async refresh(refreshToken) {
        const response = await apiClient_1.apiClient.request("/auth/refresh", {
            method: "POST",
            auth: false,
            skipRefresh: true,
            body: { refreshToken },
        });
        return ensureAuthTokens(response, "Сервер не вернул корректный access token при обновлении сессии.");
    },
    async logout(refreshToken) {
        await apiClient_1.apiClient.request("/auth/logout", {
            method: "POST",
            auth: true,
            skipRefresh: true,
            parseAs: "void",
            body: refreshToken ? { refreshToken } : undefined,
        });
    },
    async me() {
        const response = await apiClient_1.apiClient.request("/auth/me", {
            auth: true,
            skipRefresh: false,
        });
        const user = (0, userService_1.normalizeAuthUser)(response);
        if (!user) {
            throw new Error("Сервер вернул некорректный профиль пользователя.");
        }
        return user;
    },
};
