import { getAuthApiBaseUrl } from "./apiBaseUrl";
import { sessionService } from "./sessionService";

type TokenRefreshHandler = () => Promise<string | null>;

let refreshHandler: TokenRefreshHandler | null = null;

export interface ApiRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | unknown;
  auth?: boolean;
  skipRefresh?: boolean;
  signal?: AbortSignal;
  parseAs?: "json" | "text" | "void";
}

export class ApiClientError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.payload = payload;
  }
}

function isBodyInit(value: unknown): value is BodyInit {
  return (
    typeof value === "string" ||
    value instanceof Blob ||
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    value instanceof ReadableStream
  );
}

function serializeBody(body: ApiRequestOptions["body"]) {
  if (body === undefined) {
    return { body: undefined, contentType: undefined as string | undefined };
  }

  if (isBodyInit(body)) {
    return { body, contentType: undefined as string | undefined };
  }

  return {
    body: JSON.stringify(body),
    contentType: "application/json",
  };
}

async function parseResponsePayload(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const payloadRecord = payload as Record<string, unknown>;

  if (typeof payloadRecord.message === "string" && payloadRecord.message.trim()) {
    return payloadRecord.message;
  }

  if (typeof payloadRecord.error === "string" && payloadRecord.error.trim()) {
    return payloadRecord.error;
  }

  return fallback;
}

async function requestInternal<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
  retryAttempted = false,
): Promise<T> {
  const {
    auth = true,
    headers = {},
    method = "GET",
    signal,
    parseAs = "json",
    skipRefresh = false,
  } = options;
  const serialized = serializeBody(options.body);
  const nextHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  if (serialized.contentType && !nextHeaders["Content-Type"]) {
    nextHeaders["Content-Type"] = serialized.contentType;
  }

  const accessToken = auth ? sessionService.getAccessToken() : null;

  if (accessToken) {
    nextHeaders.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${getAuthApiBaseUrl()}${endpoint}`, {
    method,
    headers: nextHeaders,
    body: serialized.body,
    signal,
  });

  if (
    response.status === 401 &&
    auth &&
    !skipRefresh &&
    !retryAttempted &&
    refreshHandler
  ) {
    const refreshedToken = await refreshHandler();

    if (refreshedToken) {
      return requestInternal<T>(endpoint, options, true);
    }
  }

  if (!response.ok) {
    const payload = await parseResponsePayload(response);
    const fallbackMessage = `Ошибка API ${response.status}${
      response.statusText ? ` (${response.statusText})` : ""
    }`;
    throw new ApiClientError(
      extractErrorMessage(payload, fallbackMessage),
      response.status,
      payload,
    );
  }

  if (parseAs === "void" || response.status === 204) {
    return undefined as T;
  }

  if (parseAs === "text") {
    return (await response.text()) as T;
  }

  return (await parseResponsePayload(response)) as T;
}

export const apiClient = {
  setRefreshHandler(handler: TokenRefreshHandler) {
    refreshHandler = handler;
  },

  request<T>(endpoint: string, options?: ApiRequestOptions) {
    return requestInternal<T>(endpoint, options);
  },
};
