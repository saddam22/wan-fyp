import "server-only";
import { cookies } from "next/headers";
import { API_INTERNAL_URL } from "./auth-mode";
import { SITE_URL } from "./site";

export const SESSION_COOKIE = "ek_sid";

/** Server-side call to the EduKhata API as the signed-in browser user (cookie forwarded). */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  const headers = new Headers(init.headers);
  if (sid) headers.set("cookie", `${SESSION_COOKIE}=${sid}`);
  // The API only accepts writes that come from the web origin.
  if (init.method && init.method !== "GET") headers.set("origin", SITE_URL);
  return fetch(`${API_INTERNAL_URL}${path}`, { ...init, headers, cache: "no-store" });
}
