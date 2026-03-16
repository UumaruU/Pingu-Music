"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthApiBaseUrl = getAuthApiBaseUrl;
const DEV_AUTH_FALLBACK_URL = "http://localhost:3000";
let cachedApiBaseUrl = null;
function trimTrailingSlash(value) {
    return value.replace(/\/+$/, "");
}
function getAuthApiBaseUrl() {
    if (cachedApiBaseUrl) {
        return cachedApiBaseUrl;
    }
    const envValue = import.meta.env.VITE_AUTH_API_BASE_URL?.trim();
    if (envValue) {
        cachedApiBaseUrl = trimTrailingSlash(envValue);
        return cachedApiBaseUrl;
    }
    if (import.meta.env.DEV) {
        cachedApiBaseUrl = DEV_AUTH_FALLBACK_URL;
        return cachedApiBaseUrl;
    }
    throw new Error("Не задан VITE_AUTH_API_BASE_URL. Укажите URL backend API для auth/sync.");
}
