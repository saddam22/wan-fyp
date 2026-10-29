"use client";

let cached: { token: string; exp: number } | null = null;

/**
 * Token for the chat and call modules, from the session cookie (GET /api/me/chat-token,
 * 15 minutes). The session cookie itself stays httpOnly.
 */
export async function fetchRealtimeToken(): Promise<string | null> {
  const res = await fetch("/api/me/chat-token", { cache: "no-store" });
  if (!res.ok) return (cached = null);
  const t = (await res.json()) as { token: string; expiresAt: string };
  cached = { token: t.token, exp: Date.parse(t.expiresAt) };
  return t.token;
}

export const getRealtimeToken = () =>
  cached && cached.exp - Date.now() > 60_000 ? cached.token : fetchRealtimeToken();
