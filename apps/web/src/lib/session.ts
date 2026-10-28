import "server-only";
import { cookies } from "next/headers";
import type { Role } from "@edukhata/contracts";

/**
 * PHASE 1 DEMO SESSION. A cookie holds the role set chosen on the demo sign-in page.
 * It is not authentication: Phase 2 replaces it with a server-side session created
 * after WAN Identity Hub (OIDC) sign-in, with roles read from EduKhata's database.
 */
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

export interface DemoSession {
  name: string;
  roles: Role[];
  hue: number;
}

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

export async function getSession(): Promise<DemoSession | null> {
  const roles = parseRoles((await cookies()).get(DEMO_ROLES_COOKIE)?.value);
  if (roles.length === 0) return null;
  const who = DEMO_NAMES[roles[0]!];
  return { ...who, roles };
}
