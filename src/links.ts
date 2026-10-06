import { randomInt } from "node:crypto";

export interface Link {
  code: string;
  url: string;
  createdAt: string;
  clicks: number;
  expiresAt?: number; // epoch seconds, used as DynamoDB TTL
}

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const CODE_LENGTH = 7;
const RESERVED = new Set(["links", "health", "api", "admin"]);

/** 7 base62 characters ≈ 3.5 trillion combinations; collisions are handled by a conditional write. */
export function generateCode(length = CODE_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function validateAlias(alias: string): string | null {
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(alias)) return "Alias must be 3-32 characters: letters, digits, - or _";
  if (RESERVED.has(alias.toLowerCase())) return "Alias is reserved";
  return null;
}

export function validateUrl(raw: unknown): { url: string } | { error: string } {
  if (typeof raw !== "string" || raw.length === 0) return { error: "url is required" };
  if (raw.length > 2048) return { error: "url is too long" };
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { error: "url is not valid" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { error: "Only http and https URLs are allowed" };
  return { url: parsed.toString() };
}

export function expiryFromDays(days: unknown, now = Date.now()): number | undefined | { error: string } {
  if (days === undefined || days === null) return undefined;
  if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 365) {
    return { error: "expiresInDays must be an integer between 1 and 365" };
  }
  return Math.floor(now / 1000) + days * 86_400;
}
