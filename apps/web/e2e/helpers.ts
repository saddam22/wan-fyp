import { expect, type BrowserContext, type Page } from "@playwright/test";

export async function signInAs(context: BrowserContext, baseURL: string, roles: string) {
  await context.addCookies([{ name: "ek_demo_roles", value: roles, url: baseURL }]);
}

/** Collects console errors and uncaught exceptions on a page. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return errors;
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "page scrolls horizontally").toBeLessThanOrEqual(1);
}
