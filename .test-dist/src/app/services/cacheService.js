"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = void 0;
const plugin_store_1 = require("@tauri-apps/plugin-store");
const tauriBridge_1 = require("./tauriBridge");
const CACHE_FILE_NAME = "library-cache.json";
const CACHE_TTL_DAYS = 30;
const CACHE_PREFIX = "pingu-music-cache";
const CACHE_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
function getCacheKey(section, key) {
    return `${section}:${key}`;
}
function getExpiresAt(now = Date.now()) {
    return new Date(now + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
function isExpired(expiresAt) {
    return Date.parse(expiresAt) <= Date.now();
}
class CacheService {
    constructor() {
        Object.defineProperty(this, "tauriStore", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new plugin_store_1.LazyStore(CACHE_FILE_NAME, {
                autoSave: 250,
                defaults: {},
            })
        });
        Object.defineProperty(this, "lastCleanupAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "cleanupTask", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    async getWebEntries() {
        if (typeof window === "undefined") {
            return [];
        }
        const entries = [];
        for (let index = 0; index < window.localStorage.length; index += 1) {
            const key = window.localStorage.key(index);
            if (!key || !key.startsWith(`${CACHE_PREFIX}:`)) {
                continue;
            }
            const value = window.localStorage.getItem(key);
            if (value === null) {
                continue;
            }
            entries.push([key.replace(`${CACHE_PREFIX}:`, ""), value]);
        }
        return entries;
    }
    async getStoreEntries() {
        if (tauriBridge_1.tauriBridge.isTauriRuntime()) {
            return this.tauriStore.entries();
        }
        const entries = await this.getWebEntries();
        return entries
            .map(([key, value]) => {
            try {
                return [key, JSON.parse(value)];
            }
            catch {
                return [key, undefined];
            }
        })
            .filter((entry) => !!entry[1]);
    }
    async get(section, key) {
        const cacheKey = getCacheKey(section, key);
        if (tauriBridge_1.tauriBridge.isTauriRuntime()) {
            const envelope = await this.tauriStore.get(cacheKey);
            if (!envelope) {
                return undefined;
            }
            if (isExpired(envelope.expiresAt)) {
                await this.tauriStore.delete(cacheKey);
                return undefined;
            }
            return envelope.payload;
        }
        if (typeof window === "undefined") {
            return undefined;
        }
        const rawValue = window.localStorage.getItem(`${CACHE_PREFIX}:${cacheKey}`);
        if (!rawValue) {
            return undefined;
        }
        try {
            const envelope = JSON.parse(rawValue);
            if (isExpired(envelope.expiresAt)) {
                window.localStorage.removeItem(`${CACHE_PREFIX}:${cacheKey}`);
                return undefined;
            }
            return envelope.payload;
        }
        catch {
            window.localStorage.removeItem(`${CACHE_PREFIX}:${cacheKey}`);
            return undefined;
        }
    }
    async set(section, key, payload) {
        const envelope = {
            payload,
            cachedAt: new Date().toISOString(),
            expiresAt: getExpiresAt(),
        };
        const cacheKey = getCacheKey(section, key);
        if (tauriBridge_1.tauriBridge.isTauriRuntime()) {
            await this.tauriStore.set(cacheKey, envelope);
            void this.cleanupExpired(false);
            return;
        }
        if (typeof window === "undefined") {
            return;
        }
        window.localStorage.setItem(`${CACHE_PREFIX}:${cacheKey}`, JSON.stringify(envelope));
        void this.cleanupExpired(false);
    }
    async remove(section, key) {
        const cacheKey = getCacheKey(section, key);
        if (tauriBridge_1.tauriBridge.isTauriRuntime()) {
            await this.tauriStore.delete(cacheKey);
            return;
        }
        if (typeof window === "undefined") {
            return;
        }
        window.localStorage.removeItem(`${CACHE_PREFIX}:${cacheKey}`);
    }
    async cleanupExpired(force = true) {
        if (!force && Date.now() - this.lastCleanupAt < CACHE_CLEANUP_INTERVAL_MS) {
            return this.cleanupTask ?? undefined;
        }
        if (this.cleanupTask) {
            return this.cleanupTask;
        }
        this.cleanupTask = (async () => {
            const entries = await this.getStoreEntries();
            await Promise.all(entries.map(async ([key, envelope]) => {
                if (!isExpired(envelope.expiresAt)) {
                    return;
                }
                if (tauriBridge_1.tauriBridge.isTauriRuntime()) {
                    await this.tauriStore.delete(key);
                    return;
                }
                if (typeof window !== "undefined") {
                    window.localStorage.removeItem(`${CACHE_PREFIX}:${key}`);
                }
            }));
            this.lastCleanupAt = Date.now();
        })().finally(() => {
            this.cleanupTask = null;
        });
        return this.cleanupTask;
    }
}
exports.cacheService = new CacheService();
