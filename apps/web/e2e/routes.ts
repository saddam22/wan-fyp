import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** Sample values for dynamic segments, per route prefix. */
const PARAMS: [RegExp, string][] = [
  [/^\/mentors\/\[handle\]/, "mizanur-rahman"],
  [/^\/assignments\/\[category\]/, "practical-khata"],
  [/^\/blog\/\[slug\]/, "how-to-write-a-perfect-practical-khata"],
  [/^\/student\/orders\/\[id\]/, "o1"],
  [/^\/student\/payments\/\[id\]/, "p1"],
  [/^\/guardian\/orders\/\[id\]/, "o2"],
  [/^\/guardian\/payments\/\[id\]/, "p1"],
  [/^\/mentor\/orders\/\[id\]/, "o7"],
  [/^\/admin\/orders\/\[id\]/, "o8"],
  [/^\/support-desk\/orders\/\[id\]/, "o2"],
  [/^\/support-desk\/tickets\/\[id\]/, "tk3"],
];

/** Every page route in src/app, with dynamic segments filled in. */
export function allRoutes(): string[] {
  const root = fileURLToPath(new URL("../src/app", import.meta.url));
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f === "page.tsx") {
        let r =
          "/" +
          relative(root, dir)
            .split(/[\\/]/)
            .filter((s) => s && !s.startsWith("("))
            .join("/");
        for (const [re, v] of PARAMS) if (re.test(r)) r = r.replace(/\[[^\]]+\]/, v);
        out.push(r === "/" ? "/" : r.replace(/\/$/, ""));
      }
    }
  };
  walk(root);
  return out.sort();
}

export const AREA_ROLE: Record<string, string> = {
  student: "student",
  mentor: "mentor",
  guardian: "guardian",
  admin: "super_admin",
  accountant: "accountant",
  "support-desk": "supporter",
};

export function areaOf(route: string): string | null {
  const seg = route.split("/")[1] ?? "";
  return seg in AREA_ROLE ? seg : null;
}
