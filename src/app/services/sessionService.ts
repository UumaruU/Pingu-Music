import { AuthUser } from "../types";
import { tauriBridge } from "./tauriBridge";

const ACCESS_TOKEN_KEY = "access-token";
const REFRESH_TOKEN_KEY = "refresh-token";
const AUTH_USER_KEY = "auth-user";

let accessTokenMemory: string | null = null;
let authUserMemory: AuthUser | null = null;

function parseJson<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string) {
  const parts = token.split(".");

  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = atob(padded);
    return JSON.parse(decoded) as { exp?: number };
  } catch {
    return null;
  }
}

export const sessionService = {
  getAccessToken() {
    return accessTokenMemory;
  },

  async loadAccessToken() {
    if (accessTokenMemory) {
      return accessTokenMemory;
    }

    const accessToken = await tauriBridge.readSecureValue(ACCESS_TOKEN_KEY);
    accessTokenMemory = accessToken?.trim() ? accessToken.trim() : null;
    return accessTokenMemory;
  },

  async setAccessToken(accessToken: string | null) {
    accessTokenMemory = accessToken?.trim() ? accessToken.trim() : null;

    if (accessTokenMemory) {
      await tauriBridge.saveSecureValue(ACCESS_TOKEN_KEY, accessTokenMemory);
      return;
    }

    await tauriBridge.deleteSecureValue(ACCESS_TOKEN_KEY);
  },

  clearAccessToken() {
    accessTokenMemory = null;
    void tauriBridge.deleteSecureValue(ACCESS_TOKEN_KEY);
  },

  isAccessTokenFresh(accessToken: string | null, skewSeconds = 30) {
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

    authUserMemory = parseJson<AuthUser>(await tauriBridge.readSecureValue(AUTH_USER_KEY));
    return authUserMemory;
  },

  async setCachedUser(user: AuthUser | null) {
    authUserMemory = user;

    if (user) {
      await tauriBridge.saveSecureValue(AUTH_USER_KEY, JSON.stringify(user));
      return;
    }

    await tauriBridge.deleteSecureValue(AUTH_USER_KEY);
  },

  clearCachedUser() {
    authUserMemory = null;
    void tauriBridge.deleteSecureValue(AUTH_USER_KEY);
  },

  async getRefreshToken() {
    const refreshToken = await tauriBridge.readSecureValue(REFRESH_TOKEN_KEY);
    return refreshToken?.trim() ? refreshToken.trim() : null;
  },

  async setRefreshToken(refreshToken: string) {
    if (!refreshToken.trim()) {
      await this.clearRefreshToken();
      return;
    }

    await tauriBridge.saveSecureValue(REFRESH_TOKEN_KEY, refreshToken.trim());
  },

  async clearRefreshToken() {
    await tauriBridge.deleteSecureValue(REFRESH_TOKEN_KEY);
  },
};
