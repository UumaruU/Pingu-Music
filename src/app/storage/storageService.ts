const storagePrefix = "pingu-music";

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export const storageService = {
  get<T>(key: string, fallback: T): T {
    const storage = getStorage();

    if (!storage) {
      return fallback;
    }

    const rawValue = storage.getItem(`${storagePrefix}:${key}`);

    if (!rawValue) {
      return fallback;
    }

    try {
      return JSON.parse(rawValue) as T;
    } catch {
      return fallback;
    }
  },

  set<T>(key: string, value: T) {
    const storage = getStorage();

    if (!storage) {
      return;
    }

    storage.setItem(`${storagePrefix}:${key}`, JSON.stringify(value));
  },
};
