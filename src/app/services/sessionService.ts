import { tauriBridge } from "./tauriBridge";

const REFRESH_TOKEN_KEY = "refresh-token";

let accessTokenMemory: string | null = null;

export const sessionService = {
  getAccessToken() {
    return accessTokenMemory;
  },

  setAccessToken(accessToken: string | null) {
    accessTokenMemory = accessToken?.trim() ? accessToken.trim() : null;
  },

  clearAccessToken() {
    accessTokenMemory = null;
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

