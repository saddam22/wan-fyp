import "server-only";

/**
 * "wan": real sign-in through WAN Identity Hub and the EduKhata API (apps/api).
 * "demo": the Phase 1 role picker, for design reviews without a backend. Read at runtime.
 */
export function authMode(): "wan" | "demo" {
  return process.env.AUTH_MODE === "wan" ? "wan" : "demo";
}

/** Where the Next.js server reaches the API (never exposed to browsers; they use /api). */
export const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4200").replace(
  /\/+$/,
  "",
);
