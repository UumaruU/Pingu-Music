const ADMIN_TOKEN_KEY = "pingu-music:admin-token";

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export const adminTokenService = {
  getToken() {
    if (!canUseLocalStorage()) {
      return null;
    }

    return window.localStorage.getItem(ADMIN_TOKEN_KEY);
  },

  setToken(token: string) {
    if (!canUseLocalStorage()) {
      return;
    }

    const normalized = token.trim();

    if (!normalized) {
      window.localStorage.removeItem(ADMIN_TOKEN_KEY);
      return;
    }

    window.localStorage.setItem(ADMIN_TOKEN_KEY, normalized);
  },
};
