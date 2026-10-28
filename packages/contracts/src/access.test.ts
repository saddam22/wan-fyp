import { describe, expect, it } from "vitest";
import { canAccess, homeFor } from "./access";
import { mockApi } from "./api";

describe("dashboard access", () => {
  it("keeps each area to its roles", () => {
    expect(canAccess(["student"], "/student/orders")).toBe(true);
    expect(canAccess(["student"], "/mentor")).toBe(false);
    expect(canAccess(["mentor"], "/admin")).toBe(false);
    expect(canAccess(["guardian"], "/guardian/children")).toBe(true);
    expect(canAccess([], "/student")).toBe(false);
    expect(canAccess([], "/mentors")).toBe(true); // public mentor list, not the mentor area
  });
  it("does not give accountants admin powers", () => {
    expect(canAccess(["accountant"], "/accountant/ledger")).toBe(true);
    expect(canAccess(["accountant"], "/admin/users")).toBe(false);
    expect(canAccess(["accountant"], "/admin/settings")).toBe(false);
  });
  it("reserves staff, roles, settings, audit and security for super admins", () => {
    expect(canAccess(["admin"], "/admin/orders")).toBe(true);
    for (const p of [
      "/admin/staff",
      "/admin/roles",
      "/admin/settings",
      "/admin/audit",
      "/admin/security",
    ]) {
      expect(canAccess(["admin"], p)).toBe(false);
      expect(canAccess(["super_admin"], p)).toBe(true);
    }
    expect(canAccess(["admin"], "/admin/staffing-report")).toBe(true);
  });
  it("picks a home dashboard", () => {
    expect(homeFor(["student", "guardian"])).toBe("/guardian");
    expect(homeFor(["mentor", "student"])).toBe("/mentor");
    expect(homeFor([])).toBe("/onboarding");
  });
});

describe("mentor search", () => {
  it("filters by subject and keeps organic order", () => {
    const bio = mockApi.mentors({ subject: "biology" });
    expect(bio.length).toBeGreaterThan(0);
    expect(bio.every((m) => m.subjects.includes("biology"))).toBe(true);
    const ratings = bio.map((m) => m.rating);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
  });
  it("does not let a paid Featured badge lift ranking", () => {
    const all = mockApi.mentors({ sort: "rating" });
    const featured = all.findIndex((m) => m.badges.includes("featured"));
    const better = all.filter((m) => m.rating > all[featured]!.rating).length;
    expect(featured).toBeGreaterThanOrEqual(better);
  });
  it("finds orders by group", () => {
    expect(
      mockApi
        .orders("pending")
        .every((o) => ["awaiting_payment", "payment_review", "matching"].includes(o.status)),
    ).toBe(true);
    expect(mockApi.order("EK-24518")?.id).toBe("o1");
  });
});
