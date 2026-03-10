import { AuthUser } from "../types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
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

export function normalizeAuthUser(payload: unknown): AuthUser | null {
  const root = unwrapPayload(payload);

  if (!root) {
    return null;
  }

  const userRecord = asRecord(root.user) ?? root;
  const id = readString(userRecord, ["id", "_id", "userId", "sub"]);
  const email = readString(userRecord, ["email", "mail", "login"]);

  if (!id || !email) {
    return null;
  }

  return {
    id,
    email,
    name: readString(userRecord, ["name", "displayName", "username"]),
    avatarUrl: readString(userRecord, ["avatarUrl", "avatar", "image"]),
  };
}

export function getUserDisplayName(user: AuthUser | null) {
  if (!user) {
    return "Гость";
  }

  if (user.name?.trim()) {
    return user.name.trim();
  }

  return user.email;
}

