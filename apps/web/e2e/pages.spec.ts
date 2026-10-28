import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, signInAs, trackErrors } from "./helpers";
import { allRoutes, AREA_ROLE, areaOf } from "./routes";

const routes = allRoutes();

test("route inventory is complete", () => {
  expect(routes.length).toBeGreaterThan(100);
});

for (const route of routes) {
  test(`renders ${route}`, async ({ page, context, baseURL }) => {
    const area = areaOf(route);
    if (area) await signInAs(context, baseURL!, AREA_ROLE[area]!);
    const errors = trackErrors(page);
    const res = await page.goto(route);
    expect(res?.status(), "HTTP status").toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByTestId("demo-banner")).toBeVisible();
    if (route !== "/forbidden") await expect(page.getByTestId("forbidden")).toHaveCount(0);
    await page.waitForTimeout(300);
    await expectNoHorizontalScroll(page);
    expect(errors).toEqual([]);
  });
}
