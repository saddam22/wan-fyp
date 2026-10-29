import { execFileSync } from "node:child_process";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const HUB = "http://localhost:4100";
const PG = process.env.E2E_PG ?? "postgresql://postgres:postgres@localhost:5432";
const EDK_SECRET = "dev-only-edukhata-secret-change-me-0123"; // hub + API development default
const run = Date.now().toString(36);
/** Unique per run, so repeated runs against the same databases stay unambiguous. */
const STUDENT = `Nusrat ${run
  .slice(-4)
  .replace(/\d/g, (d) => "abcdefghij"[Number(d)]!)
  .replace(/^./, (c) => c.toUpperCase())}`;

/** Registers a WAN ID through the hub's public API (codes come from its dev outbox). */
async function registerOnHub(req: APIRequestContext, name: string, email: string): Promise<string> {
  const csrf = async () => {
    await req.get(`${HUB}/api/auth/session`);
    const state = await req.storageState();
    return state.cookies.find((c) => c.name === "csrf_token")!.value;
  };
  const headers = {
    "x-csrf-token": decodeURIComponent(await csrf()),
    "content-type": "application/json",
  };
  const start = await req.post(`${HUB}/api/registrations`, {
    headers,
    data: {
      fullName: name,
      contact: email,
      password: "Khata@2026x",
      language: "en",
      primaryPlatformId: "edukhata",
      acceptedTerms: true,
    },
  });
  expect(start.status(), await start.text()).toBe(200);
  const { registrationId } = await start.json();
  const outbox = (await (await req.get(`${HUB}/api/dev/outbox`)).json()) as {
    code: string;
    purpose: string;
  }[];
  const code = outbox.find((o) => o.purpose === "registration")!.code;
  expect(
    (
      await req.post(`${HUB}/api/registrations/${registrationId}/verify`, {
        headers,
        data: { code },
      })
    ).status(),
  ).toBe(204);
  const done = await req.post(`${HUB}/api/registrations/${registrationId}/complete`, {
    headers,
    data: {
      username: `u_${run}_${name.split(" ")[0]!.toLowerCase()}`,
      dateOfBirth: "2007-03-01",
      gender: null,
      language: "en",
      address: "",
    },
  });
  expect(done.status(), await done.text()).toBe(200);
  return (await done.json()).session.user.id as string;
}

async function wanSignIn(page: Page) {
  await page.goto("/login");
  await page.getByTestId("wan-login").click();
  await page.waitForURL((u) => u.host === "localhost:3200" && !u.pathname.startsWith("/api/"));
}

function grantRole(email: string, role: string) {
  execFileSync("pnpm", ["--filter", "@edukhata/api", "grant-role", email, role], {
    env: { ...process.env, DATABASE_URL: `${PG}/edukhata_e2e` },
    stdio: "pipe",
  });
}

test.describe.configure({ mode: "serial" });

test("WAN sign-in → onboarding → role-gated dashboards → admin roles → hub suspension", async ({
  browser,
}) => {
  // 1. A student registers a WAN ID and signs in to EduKhata with it.
  const student = await browser.newContext();
  const sp = await student.newPage();
  const studentEmail = `student.${run}@example.com`;
  const studentSub = await registerOnHub(sp.request, STUDENT, studentEmail);
  await wanSignIn(sp);
  await expect(sp).toHaveURL(/\/onboarding$/);
  await expect(sp.getByText(`Signed in as ${STUDENT}.`)).toBeVisible();

  // Dashboards are gated until onboarding is complete.
  await sp.goto("/student");
  await expect(sp).toHaveURL(/\/onboarding$/);

  await sp.getByLabel("Institution").fill("Holy Cross College");
  await sp.getByLabel("Class / year").selectOption("HSC 2nd year");
  await sp.getByRole("button", { name: "Biology" }).click();
  await sp.getByRole("button", { name: "Finish setup" }).click();
  await expect(sp).toHaveURL(/\/student$/);
  await expect(sp.getByText(STUDENT).first()).toBeVisible();

  // Signing in grants no staff role.
  await sp.goto("/admin");
  await expect(sp.getByTestId("forbidden")).toBeVisible();
  await sp.goto("/mentor");
  await expect(sp.getByTestId("forbidden")).toBeVisible();

  // 2. An operator signs in, and the first super admin is created on the server (CLI).
  const admin = await browser.newContext();
  const ap = await admin.newPage();
  const adminEmail = `admin.${run}@example.com`;
  await registerOnHub(ap.request, "Karim Uddin", adminEmail);
  await wanSignIn(ap);
  await expect(ap).toHaveURL(/\/onboarding$/);
  grantRole(adminEmail, "super_admin");
  await ap.goto("/admin/users");
  await expect(ap.getByRole("heading", { name: "Users" })).toBeVisible();

  // 3. The super admin makes the student a mentor; the API enforces it, the student sees it.
  const row = ap.getByRole("row").filter({ hasText: STUDENT });
  await row.getByRole("button", { name: "Roles" }).click();
  await ap.getByRole("dialog").getByLabel("Mentor").check();
  await ap.getByRole("button", { name: "Save roles" }).click();
  await expect(ap.getByText("Roles updated")).toBeVisible();
  await sp.goto("/mentor");
  await expect(sp.getByTestId("forbidden")).toHaveCount(0);
  await expect(sp.getByText("Mentor Dashboard").first()).toBeVisible();

  // Both events reached the student as real notifications (WAN social module).
  await expect(sp.getByTestId("bell-dot")).toBeVisible();
  await sp.getByRole("button", { name: "Notifications" }).click();
  await expect(sp.getByText("Your EduKhata roles changed")).toBeVisible();
  await expect(sp.getByTestId("bell-dot")).toHaveCount(0);
  await sp.goto("/notifications");
  await expect(sp).toHaveURL(/\/mentor\/notifications$/);
  const inbox = sp.getByTestId("live-notifications");
  await expect(inbox.getByText("Welcome to EduKhata")).toBeVisible();
  await inbox.getByText("Welcome to EduKhata").click();
  await expect(sp).toHaveURL(/\/student$/);

  // The audit log (super admin only) records the change.
  await ap.goto("/admin/audit");
  await expect(ap.getByText("user.roles").first()).toBeVisible();

  // 4. WAN Identity Hub suspends the student's EduKhata access (platform API) →
  //    the next request ends the EduKhata session and WAN sign-in is refused.
  const auth = `Basic ${Buffer.from(`edukhata:${EDK_SECRET}`).toString("base64")}`;
  const put = await sp.request.put(`${HUB}/platform-api/v1/entitlements/${studentSub}`, {
    headers: { authorization: auth, "content-type": "application/json" },
    data: { status: "suspended", reason: "e2e" },
  });
  expect(put.status()).toBe(200);
  await sp.goto("/student");
  await expect(sp).toHaveURL(/\/access-request\?reason=denied/);
  await expect(
    sp.getByRole("heading", { name: "Your EduKhata access is not active" }),
  ).toBeVisible();
  await wanSignIn(sp);
  await expect(sp).toHaveURL(/\/access-request\?reason=denied/);

  // 5. The student asks again in the hub; the admin approves it in EduKhata.
  await sp.request.get(`${HUB}/api/auth/session`);
  const csrf = (await student.storageState()).cookies.find((c) => c.name === "csrf_token")!.value;
  const ask = await sp.request.post(`${HUB}/api/me/access-requests`, {
    headers: { "x-csrf-token": decodeURIComponent(csrf), "content-type": "application/json" },
    data: { platformId: "edukhata", roleId: "member", reason: "Please restore my EduKhata access" },
  });
  expect(ask.status(), await ask.text()).toBe(200);
  await ap.goto("/admin/access-requests");
  await ap
    .getByRole("listitem")
    .filter({ hasText: STUDENT })
    .getByRole("button", { name: "Approve" })
    .click();
  await expect(ap.getByText(`${STUDENT} can use EduKhata`)).toBeVisible();
  await wanSignIn(sp);
  await expect(sp).toHaveURL(/\/(mentor|student)$/);

  // 6. Sign out ends the session.
  await sp.goto("/student");
  await sp.getByRole("button", { name: "Account menu" }).click();
  await sp.getByRole("button", { name: "Sign out" }).click();
  await expect(sp).toHaveURL("http://localhost:3200/");
  await sp.goto("/student");
  await expect(sp).toHaveURL(/\/login\?next=%2Fstudent|\/login\?next=\/student/);
});

test("guardian links a child with a one-time code; the student controls and ends it", async ({
  browser,
}) => {
  const WEB = "http://localhost:3200";
  const onboard = (p: Page, data: object) =>
    p.request.post(`${WEB}/api/me/onboarding`, { headers: { origin: WEB }, data });

  const st = await browser.newContext();
  const sp = await st.newPage();
  const email = `kid.${run}@example.com`;
  const kidName = `Tahsin ${STUDENT.split(" ")[1]}`;
  await registerOnHub(sp.request, kidName, email);
  await wanSignIn(sp);
  expect(
    (
      await onboard(sp, {
        kind: "student",
        institution: "Dhaka College",
        classLevel: "HSC 1st year",
        subjects: ["ict"],
      })
    ).status(),
  ).toBe(200);
  await sp.goto("/student/profile");
  await sp.getByRole("button", { name: "Generate link code" }).click();
  const code = (await sp.getByTestId("guardian-code").textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{8}$/);

  const gu = await browser.newContext();
  const gp = await gu.newPage();
  await registerOnHub(gp.request, `Rokeya ${STUDENT.split(" ")[1]}`, `guardian.${run}@example.com`);
  await wanSignIn(gp);
  expect((await onboard(gp, { kind: "guardian" })).status()).toBe(200);
  await gp.goto("/guardian/children");
  await expect(gp.getByText("No children linked yet")).toBeVisible();
  // A wrong code is refused with the same message as a wrong email.
  await gp.getByLabel("Child's email or mobile").fill(email);
  await gp.getByLabel("Link code").fill("ZZZZ2222");
  await gp.getByRole("button", { name: "Link child" }).click();
  await expect(gp.getByText("Email/phone or link code is not correct")).toBeVisible();
  await gp.getByLabel("Link code").fill(code.toLowerCase());
  await gp.getByRole("button", { name: "Link child" }).click();
  await expect(gp.getByText(`${kidName} is linked`)).toBeVisible();
  await expect(
    gp.getByTestId("linked-children").getByText("HSC 1st year · Dhaka College"),
  ).toBeVisible();

  // The student sees the guardian, turns off payments, then unlinks.
  await sp.goto("/student/profile");
  const links = sp.getByTestId("guardian-links");
  await expect(links.getByText(`Rokeya ${STUDENT.split(" ")[1]}`)).toBeVisible();
  await links.getByLabel("View payments").uncheck();
  await expect(links.getByLabel("View payments")).not.toBeChecked();
  await gp.goto("/guardian/privacy");
  await expect(gp.getByRole("row").filter({ hasText: kidName })).toContainText("✓—");
  await links.getByRole("button", { name: "Unlink" }).click();
  await expect(sp.getByText(/unlinked$/)).toBeVisible();
  await gp.goto("/guardian/children");
  await expect(gp.getByText("No children linked yet")).toBeVisible();
});

test("the API refuses cross-site writes and unauthenticated admin calls", async ({ request }) => {
  const evil = await request.post("/api/me/onboarding", {
    headers: { origin: "https://evil.example" },
    data: { kind: "guardian" },
  });
  expect(evil.status()).toBe(403);
  expect((await request.get("/api/admin/users")).status()).toBe(401);
});
