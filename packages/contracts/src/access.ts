import type { Role } from "./types";

/**
 * Which roles may open which dashboard area. The web app uses this only to choose
 * what to render; from Phase 2 the API enforces the same rules on every request.
 */
export const AREA_ROLES = {
  student: ["student"],
  mentor: ["mentor"],
  guardian: ["guardian"],
  admin: ["admin", "super_admin"],
  accountant: ["accountant", "super_admin"],
  "support-desk": ["supporter", "admin", "super_admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Area = keyof typeof AREA_ROLES;

/** Admin pages only a super admin may open (staff, roles, system settings, audit, security). */
export const SUPER_ADMIN_ONLY = [
  "/admin/staff",
  "/admin/roles",
  "/admin/settings",
  "/admin/audit",
  "/admin/security",
];

export function areaOf(pathname: string): Area | null {
  const seg = pathname.split("/")[1] ?? "";
  return seg in AREA_ROLES ? (seg as Area) : null;
}

export function canAccess(roles: readonly Role[], pathname: string): boolean {
  const area = areaOf(pathname);
  if (!area) return true;
  const allowed: readonly Role[] = AREA_ROLES[area];
  if (!roles.some((r) => allowed.includes(r))) return false;
  if (SUPER_ADMIN_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return roles.includes("super_admin");
  }
  return true;
}

/** Home dashboard for a set of roles, most privileged first. */
export function homeFor(roles: readonly Role[]): string {
  if (roles.includes("super_admin") || roles.includes("admin")) return "/admin";
  if (roles.includes("accountant")) return "/accountant";
  if (roles.includes("supporter")) return "/support-desk";
  if (roles.includes("mentor")) return "/mentor";
  if (roles.includes("guardian")) return "/guardian";
  if (roles.includes("student")) return "/student";
  return "/onboarding";
}

export const ROLE_LABEL: Record<Role, string> = {
  student: "Student",
  guardian: "Guardian",
  mentor: "Mentor",
  supporter: "Supporter",
  accountant: "Accountant",
  admin: "Admin",
  super_admin: "Super Admin",
};
