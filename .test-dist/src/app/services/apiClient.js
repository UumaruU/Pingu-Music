"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiClient = exports.ApiClientError = void 0;
const apiBaseUrl_1 = require("./apiBaseUrl");
const sessionService_1 = require("./sessionService");
let refreshHandler = null;
class ApiClientError extends Error {
    constructor(message, status, payload) {
        super(message);
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "payload", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = "ApiClientError";
        this.status = status;
        this.payload = payload;
    }
}
exports.ApiClientError = ApiClientError;
function isBodyInit(value) {
    return (typeof value === "string" ||
        value instanceof Blob ||
        value instanceof FormData ||
        value instanceof URLSearchParams ||
        value instanceof ArrayBuffer ||
        ArrayBuffer.isView(value) ||
        value instanceof ReadableStream);
}
function serializeBody(body) {
    if (body === undefined) {
        return { body: undefined, contentType: undefined };
    }
    if (isBodyInit(body)) {
        return { body, contentType: undefined };
    }
    return {
        body: JSON.stringify(body),
        contentType: "application/json",
    };
}
async function parseResponsePayload(response) {
    const text = await response.text();
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
function extractErrorMessage(payload, fallback) {
    if (!payload || typeof payload !== "object") {
        return fallback;
    }
    const payloadRecord = payload;
    if (typeof payloadRecord.message === "string" && payloadRecord.message.trim()) {
        return payloadRecord.message;
    }
    if (typeof payloadRecord.error === "string" && payloadRecord.error.trim()) {
        return payloadRecord.error;
    }
    return fallback;
}
async function requestInternal(endpoint, options = {}, retryAttempted = false) {
    const { auth = true, headers = {}, method = "GET", keepalive = false, signal, parseAs = "json", skipRefresh = false, } = options;
    const serialized = serializeBody(options.body);
    const nextHeaders = {
        Accept: "application/json",
        ...headers,
    };
    if (serialized.contentType && !nextHeaders["Content-Type"]) {
        nextHeaders["Content-Type"] = serialized.contentType;
    }
    const accessToken = auth ? sessionService_1.sessionService.getAccessToken() : null;
    if (accessToken) {
        nextHeaders.Authorization = `Bearer ${accessToken}`;
    }
    const response = await fetch(`${(0, apiBaseUrl_1.getAuthApiBaseUrl)()}${endpoint}`, {
        method,
        headers: nextHeaders,
        body: serialized.body,
        keepalive,
        signal,
    });
    if (response.status === 401 &&
        auth &&
        !skipRefresh &&
        !retryAttempted &&
        refreshHandler) {
        const refreshedToken = await refreshHandler();
        if (refreshedToken) {
            return requestInternal(endpoint, options, true);
        }
    }
    if (!response.ok) {
        const payload = await parseResponsePayload(response);
        const fallbackMessage = `Ошибка API ${response.status}${response.statusText ? ` (${response.statusText})` : ""}`;
        throw new ApiClientError(extractErrorMessage(payload, fallbackMessage), response.status, payload);
    }
    if (parseAs === "void" || response.status === 204) {
        return undefined;
    }
    if (parseAs === "text") {
        return (await response.text());
    }
    return (await parseResponsePayload(response));
}
exports.apiClient = {
    setRefreshHandler(handler) {
        refreshHandler = handler;
    },
    request(endpoint, options) {
        return requestInternal(endpoint, options);
    },
};
