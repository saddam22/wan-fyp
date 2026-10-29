import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test.describe("role access", () => {
  test("anonymous users are sent to sign in", async ({ page }) => {
    await page.goto("/student/orders");
    await expect(page).toHaveURL(/\/login\?next=(%2F|\/)student/);
  });

  const denied: [string, string][] = [
    ["student", "/mentor"],
    ["student", "/admin"],
    ["mentor", "/accountant"],
    ["guardian", "/student"],
    ["accountant", "/admin"],
    ["supporter", "/accountant/ledger"],
    ["admin", "/admin/settings"],
    ["admin", "/admin/roles"],
    ["admin", "/admin/staff"],
    ["admin", "/admin/audit"],
    ["admin", "/admin/security"],
  ];
  for (const [role, path] of denied) {
    test(`${role} cannot open ${path}`, async ({ page, context, baseURL }) => {
      await signInAs(context, baseURL!, role);
      await page.goto(path);
      await expect(page.getByTestId("forbidden")).toBeVisible();
    });
  }

  test("super admin opens system settings", async ({ page, context, baseURL }) => {
    await signInAs(context, baseURL!, "super_admin");
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "System Settings" })).toBeVisible();
  });

  test("admin sidebar hides super-admin links", async ({ page, context, baseURL }, info) => {
    test.skip(info.project.name === "mobile", "sidebar is in a drawer on mobile");
    await signInAs(context, baseURL!, "admin");
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Orders" }).first()).toBeVisible();
  });

  test("students cannot open another student's order", async ({ page, context, baseURL }) => {
    await signInAs(context, baseURL!, "student");
    const res = await page.goto("/student/orders/o7");
    expect(res?.status()).toBe(404);
  });

  test("demo sign-in lands on the role dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("demo-accountant").click();
    await expect(page).toHaveURL(/\/accountant$/);
    await expect(page.getByRole("heading", { name: "Accounts overview" })).toBeVisible();
  });
});
