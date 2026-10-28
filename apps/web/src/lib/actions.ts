"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { homeFor } from "@edukhata/contracts";
import { apiFetch, SESSION_COOKIE } from "./api";
import { authMode } from "./auth-mode";
import { isLang, LANG_COOKIE } from "./i18n";
import { DEMO_ROLES_COOKIE, parseRoles } from "./session";

const YEAR = 60 * 60 * 24 * 365;

export async function setLanguage(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: YEAR, sameSite: "lax" });
}

/** Demo sign-in: pick a role set. Only in AUTH_MODE=demo. */
export async function demoSignIn(formData: FormData) {
  if (authMode() !== "demo") return;
  const roles = parseRoles(String(formData.get("roles") ?? ""));
  if (roles.length === 0) return;
  (await cookies()).set(DEMO_ROLES_COOKIE, roles.join(","), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
  });
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : homeFor(roles));
}

export async function signOut() {
  const jar = await cookies();
  if (authMode() === "wan" && jar.get(SESSION_COOKIE)) {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    jar.delete(SESSION_COOKIE);
  }
  jar.delete(DEMO_ROLES_COOKIE);
  redirect("/");
}
