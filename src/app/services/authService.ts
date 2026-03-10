import { AuthSession, AuthTokens } from "../types";
import { apiClient } from "./apiClient";
import { normalizeAuthUser } from "./userService";

interface AuthCredentials {
  email: string;
  password: string;
}

interface RegisterPayload extends AuthCredentials {
  name?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function unwrapPayload(payload: unknown) {
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

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function normalizeAuthTokens(payload: unknown): AuthTokens | null {
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

function normalizeAuthSession(payload: unknown): AuthSession | null {
  const user = normalizeAuthUser(payload);
  const tokens = normalizeAuthTokens(payload);

  if (!user || !tokens) {
    return null;
  }

  return { user, tokens };
}

function ensureAuthSession(payload: unknown, errorMessage: string) {
  const session = normalizeAuthSession(payload);

  if (!session) {
    throw new Error(errorMessage);
  }

  return session;
}

function ensureAuthTokens(payload: unknown, errorMessage: string) {
  const tokens = normalizeAuthTokens(payload);

  if (!tokens) {
    throw new Error(errorMessage);
  }

  return tokens;
}

export const authService = {
  async register(payload: RegisterPayload) {
    const response = await apiClient.request<unknown>("/auth/register", {
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
      email: payload.email,
      password: payload.password,
    });
  },

  async login(payload: AuthCredentials) {
    const response = await apiClient.request<unknown>("/auth/login", {
      method: "POST",
      auth: false,
      skipRefresh: true,
      body: payload,
    });

    return ensureAuthSession(
      response,
      "Сервер не вернул корректные данные сессии при входе.",
    );
  },

  async refresh(refreshToken: string) {
    const response = await apiClient.request<unknown>("/auth/refresh", {
      method: "POST",
      auth: false,
      skipRefresh: true,
      body: { refreshToken },
    });

    return ensureAuthTokens(
      response,
      "Сервер не вернул корректный access token при обновлении сессии.",
    );
  },

  async logout(refreshToken?: string) {
    await apiClient.request<void>("/auth/logout", {
      method: "POST",
      auth: true,
      skipRefresh: true,
      parseAs: "void",
      body: refreshToken ? { refreshToken } : undefined,
    });
  },

  async me() {
    const response = await apiClient.request<unknown>("/auth/me", {
      auth: true,
      skipRefresh: false,
    });
    const user = normalizeAuthUser(response);

    if (!user) {
      throw new Error("Сервер вернул некорректный профиль пользователя.");
    }

    return user;
  },
};

