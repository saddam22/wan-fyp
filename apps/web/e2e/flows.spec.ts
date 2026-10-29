import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("order wizard validates each step and reaches payment", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "student");
  await page.goto("/order/new");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Choose a category")).toBeVisible();
  await page.locator("form label").filter({ hasText: "Practical Khata (Handwritten)" }).click();
  await page.getByLabel("Subject").selectOption("biology");
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText(/Write a short title/)).toBeVisible();
  await page.getByLabel("Title").fill("Biology Practical Khata — Class 12");
  await page
    .getByLabel("Instructions")
    .fill("Dhaka board 2026 syllabus, labelled diagrams, blue ink, neat handwriting.");
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Choose a deadline")).toBeVisible();
  const d = new Date(Date.now() + 3 * 86400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  await page
    .getByLabel("Deadline")
    .fill(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:00`);
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByLabel("Coupon code").fill("welcome20");
  await expect(page.getByText("WELCOME20", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Place order & pay/ }).click();
  await expect(page.getByText(/accept the terms/)).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Place order & pay/ }).click();
  await expect(page).toHaveURL(/\/student\/payments\/p1\/pay/);
});

test("manual payment rejects bad and reused transaction IDs", async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, baseURL!, "student");
  await page.goto("/student/payments/p1/pay");
  await page.getByLabel("Sender number").fill("01712");
  await page.getByLabel("Transaction ID (TrxID)").fill("12");
  await page.getByRole("button", { name: "Submit for verification" }).click();
  await expect(page.getByText(/Enter the number you sent from/)).toBeVisible();
  await expect(page.getByText(/TrxID exactly as in the SMS/)).toBeVisible();

  await page.getByLabel("Sender number").fill("০১৭১২৩৪৫৬৭৮");
  await page.getByLabel("Transaction ID (TrxID)").fill("bkx92kd71l");
  await page.getByRole("button", { name: "Submit for verification" }).click();
  await expect(page.getByText(/already used for another payment/)).toBeVisible();

  await page.getByLabel("Transaction ID (TrxID)").fill("NEW7TRX99");
  await page.getByRole("button", { name: "Submit for verification" }).click();
  await expect(page.getByRole("heading", { name: /submitted for verification/ })).toBeVisible();
});

test("mentor sees the lost-race message when another mentor accepted first", async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, baseURL!, "mentor");
  await page.goto("/mentor/offers");
  const row = page.getByRole("listitem").filter({ hasText: "Mitosis stages" });
  await row.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("Another mentor accepted first")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Mitosis stages" })).toHaveCount(0);
});

test("student approves a delivered order", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "student");
  await page.goto("/student/orders/o2");
  await expect(page.getByText("Locked")).toBeVisible();
  await page.getByRole("button", { name: "Approve work" }).click();
  await page.getByRole("button", { name: "Approve & release payment" }).click();
  await expect(page.getByText("Work approved")).toBeVisible();
  await expect(page.getByText("Locked")).toHaveCount(0);
});

test("revision request needs instructions", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "student");
  await page.goto("/student/orders/o2");
  await page.getByRole("button", { name: "Request revision" }).click();
  await expect(page.getByText("1 free revision left.")).toBeVisible();
  await page.getByRole("button", { name: "Send revision request" }).click();
  await expect(page.getByText(/Explain what needs to change/)).toBeVisible();
});

test("accountant rejects a payment with a reason", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "accountant");
  await page.goto("/accountant/payments");
  await page.getByText("INV-2026-01846").locator("visible=true").first().click();
  await page.getByRole("button", { name: "Reject" }).click();
  await page.getByRole("button", { name: "Reject payment" }).click();
  await expect(page.getByText(/Tell the payer why/)).toBeVisible();
  await page.getByLabel("Reason shown to payer").fill("TrxID not found in Nagad statement");
  await page.getByRole("button", { name: "Reject payment" }).click();
  await expect(page.getByText("INV-2026-01846 rejected")).toBeVisible();
});

test("switches the interface to Bengali", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "switch is in the drawer on mobile");
  await page.goto("/");
  await page.getByLabel("Language").first().selectOption("bn");
  await expect(page.getByRole("link", { name: "রেজিস্টার" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await page.getByLabel("Language").first().selectOption("en");
  await expect(page.getByRole("link", { name: "Register" })).toBeVisible();
});
