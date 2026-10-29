import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { homeFor, type Role } from "@edukhata/contracts";
import { apiFetch, SESSION_COOKIE } from "./api";
import { authMode } from "./auth-mode";

export interface Session {
  name: string;
  roles: Role[];
  hue: number;
  /** False until the person finished /onboarding (no marketplace role yet). */
  onboardingComplete: boolean;
  home: string;
  /** "demo" sessions come from the Phase 1 role picker and are not authentication. */
  mode: "wan" | "demo";
}

export const DEMO_ROLES_COOKIE = "ek_demo_roles";

const ALL_ROLES: Role[] = [
  "student",
  "guardian",
  "mentor",
  "supporter",
  "accountant",
  "admin",
  "super_admin",
];

const DEMO_NAMES: Record<Role, { name: string; hue: number }> = {
  student: { name: "Mahfuz Rahman", hue: 210 },
  guardian: { name: "Shirin Akter", hue: 40 },
  mentor: { name: "Dr. Mizanur Rahman", hue: 205 },
  supporter: { name: "Joya Akter", hue: 20 },
  accountant: { name: "Rumana Haque", hue: 140 },
  admin: { name: "Karim Uddin", hue: 350 },
  super_admin: { name: "Super Admin", hue: 260 },
};

export function parseRoles(raw: string | undefined): Role[] {
  if (!raw) return [];
  return raw.split(",").filter((r): r is Role => (ALL_ROLES as string[]).includes(r));
}

const hueOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

/**
 * The signed-in person. In "wan" mode this is the API's view of the session cookie
 * (roles from EduKhata's database); a person whose EduKhata access the hub suspended
 * is sent to the access page.
 */
export async function getSession(): Promise<Session | null> {
  if (authMode() === "demo") {
    const roles = parseRoles((await cookies()).get(DEMO_ROLES_COOKIE)?.value);
    if (roles.length === 0) return null;
    return {
      ...DEMO_NAMES[roles[0]!],
      roles,
      onboardingComplete: true,
      home: homeFor(roles),
      mode: "demo",
    };
  }
  if (!(await cookies()).get(SESSION_COOKIE)) return null;
  let res: Response;
  try {
    res = await apiFetch("/me");
  } catch {
    return null; // API down: behave as signed out rather than failing every page
  }
  if (res.status === 403) {
    const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    if (body?.error?.code === "platform_access_denied") redirect("/access-request?reason=denied");
  }
  if (!res.ok) return null;
  const me = (await res.json()) as {
    user: { id: string; name: string };
    roles: Role[];
    onboardingComplete: boolean;
    home: string;
  };
  return {
    name: me.user.name,
    roles: me.roles,
    hue: hueOf(me.user.id),
    onboardingComplete: me.onboardingComplete,
    home: me.home,
    mode: "wan",
  };
}
