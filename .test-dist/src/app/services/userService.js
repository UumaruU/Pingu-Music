"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAuthUser = normalizeAuthUser;
exports.getUserDisplayName = getUserDisplayName;
function asRecord(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    return value;
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
function normalizeAuthUser(payload) {
    const root = unwrapPayload(payload);
    if (!root) {
        return null;
    }
    const userRecord = asRecord(root.user) ?? root;
    const id = readString(userRecord, ["id", "_id", "userId", "sub"]);
    const login = readString(userRecord, ["login", "username", "email", "mail"]);
    if (!id || !login) {
        return null;
    }
    return {
        id,
        login,
        name: readString(userRecord, ["name", "displayName"]),
        avatarUrl: readString(userRecord, ["avatarUrl", "avatar", "image"]),
    };
}
function getUserDisplayName(user) {
    if (!user) {
        return "Гость";
    }
    if (user.name?.trim()) {
        return user.name.trim();
    }
    return user.login;
}
