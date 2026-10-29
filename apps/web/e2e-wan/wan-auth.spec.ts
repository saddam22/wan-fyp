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

/** Pauses mentors left in the e2e database by earlier runs, so offers go to this run's mentor. */
function pauseOtherMentors() {
  execFileSync(
    "psql",
    [`${PG}/edukhata_e2e`, "-c", "update mentor_profiles set available = false"],
    {
      stdio: "pipe",
    },
  );
}

function grantRole(email: string, role: string) {
  execFileSync("pnpm", ["--filter", "@edukhata/api", "grant-role", email, role], {
    env: { ...process.env, DATABASE_URL: `${PG}/edukhata_e2e` },
    stdio: "pipe",
  });
}

test.describe.configure({ mode: "serial" });

/**
 * The super admin from the first test, kept signed in for later tests: the hub allows
 * 10 registrations per 15 minutes from one address, and the suite needs more people.
 */
let superAdmin: { page: Page; email: string } | undefined;

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
  superAdmin = { page: ap, email: adminEmail };
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

test("a ?ref link opened before sign-up credits the referrer at onboarding", async ({
  browser,
}) => {
  const suffix = STUDENT.split(" ")[1]!;
  const a = await browser.newContext();
  const ap = await a.newPage();
  await registerOnHub(ap.request, `Arif ${suffix}`, `arif.${run}@example.com`);
  await wanSignIn(ap);
  await ap.getByLabel("Institution").fill("Notre Dame College");
  await ap.getByLabel("Class / year").selectOption("HSC 2nd year");
  await ap.getByRole("button", { name: "ICT" }).click();
  await ap.getByRole("button", { name: "Finish setup" }).click();
  await expect(ap).toHaveURL(/\/student$/);
  await ap.goto("/student/referrals");
  const code = (await ap
    .getByText(/^EDK-ARIF-/)
    .first()
    .textContent())!.trim();

  const f = await browser.newContext();
  const fp = await f.newPage();
  await fp.goto(`/how-it-works?ref=${code}`);
  await registerOnHub(fp.request, `Mitu ${suffix}`, `mitu.${run}@example.com`);
  await wanSignIn(fp);
  await expect(fp.getByText(`You were invited by Arif`)).toBeVisible();
  await fp.getByLabel("Institution").fill("Viqarunnisa Noon College");
  await fp.getByLabel("Class / year").selectOption("HSC 1st year");
  await fp.getByRole("button", { name: "Biology" }).click();
  await fp.getByRole("button", { name: "Finish setup" }).click();
  await expect(fp).toHaveURL(/\/student$/);

  await ap.goto("/student/referrals");
  await expect(ap.getByRole("listitem").filter({ hasText: "Mitu" })).toContainText("Joined");
  await ap.goto("/student/notifications");
  await expect(ap.getByText("A friend joined with your code")).toBeVisible();
});

test("a student messages and calls EduKhata support in real time; no direct chats between students", async ({
  browser,
}) => {
  const suffix = STUDENT.split(" ")[1]!;
  const signUpStudent = async (first: string, email: string) => {
    const c = await browser.newContext();
    const p = await c.newPage();
    await registerOnHub(p.request, `${first} ${suffix}`, email);
    await wanSignIn(p);
    await p.getByLabel("Institution").fill("Dhaka College");
    await p.getByLabel("Class / year").selectOption("HSC 2nd year");
    await p.getByRole("button", { name: "Physics" }).click();
    await p.getByRole("button", { name: "Finish setup" }).click();
    await expect(p).toHaveURL(/\/student$/);
    return p;
  };
  const sp = await signUpStudent("Sumaiya", `sumaiya.${run}@example.com`);
  const supEmail = `support.${run}@example.com`;
  const up = await signUpStudent("Joya", supEmail);
  grantRole(supEmail, "supporter");
  await up.goto("/support-desk/chat");
  await expect(up.getByTestId("live-chat").getByText("No chats yet")).toBeVisible();

  await sp.goto("/student/messages");
  const chat = sp.getByTestId("live-chat");
  await chat.locator(".cm-sidebar__header").getByRole("button", { name: "New chat" }).click();
  const dialog = sp.getByRole("dialog", { name: "New chat" });
  // Groups are off, and other students can't be found.
  await expect(dialog.getByRole("tab", { name: "Group" })).toHaveCount(0);
  await dialog.getByPlaceholder("Type a name").fill("Sumaiya");
  await expect(dialog.getByRole("option")).toHaveCount(0);
  await dialog.getByPlaceholder("Type a name").fill("Joya");
  await dialog.getByRole("option", { name: new RegExp(`Joya ${suffix}`) }).click();
  await expect(sp).toHaveURL(/\/student\/messages\?c=/);
  await chat.locator(".cm-composer textarea").fill("My bKash payment shows pending");
  await chat.locator(".cm-composer textarea").press("Enter");

  // Arrives at the support desk without a reload, with a notification.
  const row = up.getByTestId("live-chat").locator(".cm-row", { hasText: `Sumaiya ${suffix}` });
  await expect(row).toContainText("My bKash payment shows pending");
  await row.click();
  await up.getByTestId("live-chat").locator(".cm-composer textarea").fill("Checking it now");
  await up.getByTestId("live-chat").locator(".cm-composer textarea").press("Enter");
  await expect(chat.locator(".cm-bubble__text", { hasText: "Checking it now" })).toBeVisible();
  await up.goto("/support-desk/notifications");
  await expect(up.getByText(`New message from Sumaiya ${suffix}`)).toBeVisible();

  // A real WebRTC audio call from the chat header; it rings on any dashboard page.
  await chat.getByRole("button", { name: `Audio call Joya ${suffix}` }).click();
  await expect(sp.getByRole("dialog")).toContainText("Ringing…");
  await expect(up.getByRole("dialog")).toContainText("Incoming audio call");
  await up.getByRole("button", { name: "Accept call" }).click();
  await expect(sp.locator(".agc-timer")).toBeVisible({ timeout: 20_000 });
  await expect(up.locator(".agc-timer")).toBeVisible({ timeout: 20_000 });
  await sp.getByRole("button", { name: "End call" }).click();
  await expect(up.locator(".agc-timer")).toHaveCount(0);
});

test("full order journey: order → pay → verify → match → deliver → approve → close → payout", async ({
  browser,
}) => {
  const suffix = STUDENT.split(" ")[1]!;
  const c = await browser.newContext();
  const p = await c.newPage();
  await registerOnHub(p.request, `Rafi ${suffix}`, `rafi.${run}@example.com`);
  await wanSignIn(p);
  await p.getByLabel("Institution").fill("Dhaka College");
  await p.getByLabel("Class / year").selectOption("HSC 2nd year");
  await p.getByRole("button", { name: "Biology" }).click();
  await p.getByRole("button", { name: "Finish setup" }).click();
  await expect(p).toHaveURL(/\/student$/);

  await p.goto("/student/new-order");
  await p.getByText("Practical Khata (Handwritten)").click();
  await p.getByLabel("Type of work").selectOption("practical_khata");
  await p.getByLabel("Level").selectOption("hsc");
  await p.getByLabel("Subject").selectOption("biology");
  await p.getByRole("button", { name: "Next" }).click();
  await p.getByLabel("Title").fill("Biology practical khata, chapter 2");
  await p
    .getByLabel("Instructions")
    .fill("Dhaka board. Chapter 2 experiments, labelled diagrams, neat handwriting.");
  await p.getByLabel("Pages").fill("13");
  await p.locator('input[type="file"]').setInputFiles({
    name: "syllabus.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"),
  });
  await p.getByRole("button", { name: "Next" }).click();
  const d = new Date(Date.now() + 3 * 24 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  await p
    .getByLabel("Deadline")
    .fill(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`);
  await p.getByRole("button", { name: "Next" }).click();
  await p.getByRole("checkbox").check();
  // 13 pages × ৳50 from the API's price list (the mentor's 80% clears the ৳500 minimum payout).
  await p.getByRole("button", { name: /Place order · ৳650/ }).click();
  await expect(p).toHaveURL(/\/student\/orders\/[0-9a-f-]{36}$/);
  await expect(p.getByText("Biology practical khata, chapter 2").first()).toBeVisible();
  await expect(p.getByText("syllabus.pdf")).toBeVisible();
  await expect(p.getByRole("link", { name: "Pay now" })).toBeVisible();
  const orderId = p.url().split("/").pop()!;
  await p.goto("/student/orders");
  await expect(
    p.getByRole("row").filter({ hasText: "Biology practical khata, chapter 2" }),
  ).toBeVisible();

  // A mentor turns on matching for their subjects (the only available one).
  pauseOtherMentors();
  const mEmail = `mentor.${run}@example.com`;
  const mc = await browser.newContext();
  const mp = await mc.newPage();
  await registerOnHub(mp.request, `Nadia ${suffix}`, mEmail);
  await wanSignIn(mp);
  grantRole(mEmail, "mentor");
  await mp.goto("/mentor/profile");
  await mp.getByRole("button", { name: "Biology", exact: true }).click();
  await mp.getByRole("button", { name: "Practical khata" }).click();
  await mp.getByTestId("mentor-available").check();
  await mp.getByRole("button", { name: "Save profile" }).click();
  await expect(mp.getByText("Profile saved")).toBeVisible();
  await mp.goto("/mentor/offers");
  await expect(mp.getByText("0 open offers")).toBeVisible();

  // Accounts team: an accountant who is also an admin adds the receiving account.
  let ap = superAdmin?.page;
  if (!ap) {
    const aEmail = `accounts.${run}@example.com`;
    ap = await (await browser.newContext()).newPage();
    await registerOnHub(ap.request, `Karim ${suffix}`, aEmail);
    await wanSignIn(ap);
    grantRole(aEmail, "accountant");
    grantRole(aEmail, "admin");
  }
  await ap.goto("/accountant/accounts");
  await ap.getByRole("button", { name: "Add account" }).click();
  await ap.getByLabel("Display name").fill("EduKhata bKash");
  await ap.getByLabel("Number / account no.").fill("01700000001");
  await ap.getByLabel("Instructions (one per line)").fill("Open bKash and choose Send Money");
  await ap.getByRole("button", { name: "Save" }).click();
  await expect(ap.getByText("Account saved")).toBeVisible();

  // The student pays by bKash and submits the TrxID.
  const trx = `T${run}`.toUpperCase().slice(0, 12).padEnd(10, "X");
  await p.goto(`/student/orders/${orderId}`);
  await p.getByRole("link", { name: "Pay now" }).click();
  await expect(p).toHaveURL(new RegExp(`/student/orders/${orderId}/pay$`));
  await expect(p.getByText("01700000001")).toBeVisible();
  await p.getByLabel("Sender number").fill("01811111111");
  await p.getByLabel("Transaction ID (TrxID)").fill(trx);
  await p.getByRole("button", { name: "Submit for verification" }).click();
  await expect(p.getByText("Payment submitted for verification")).toBeVisible();

  // The accountant matches it with the statement and approves: matching starts.
  await ap.goto("/accountant/payments");
  await ap.getByRole("row").filter({ hasText: trx }).click();
  await ap.getByRole("button", { name: "Approve" }).click();
  await expect(ap.getByText(/approved$/).first()).toBeVisible();

  // The mentor gets the offer and accepts it, starts and delivers.
  await mp.goto("/mentor/offers");
  await mp.getByRole("button", { name: "Accept" }).first().click();
  await mp.goto(`/mentor/orders/${orderId}`);
  await mp.getByRole("button", { name: "Start work" }).click();
  await expect(mp.getByText("Work started")).toBeVisible();
  await mp.getByRole("button", { name: "Deliver work" }).click();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAfUlEQVRoge2SAQkAURSDFt8sl8VQF2M8/sAAOhY+T5O6AQuwviK7kHdJ3YAFWF+RXci7pG7AAqyvyC7kXVI3YAHWV2QX8i6pG7AA6yuyC3mX1A1YgPUV2YW8S+oGLMD6iuxC3iV1AxZgfUV2Ie+SugELsL4iu5B3Sd2AxwN+DczpWk8Fb+cAAAAASUVORK5CYII=",
    "base64",
  );
  await mp
    .locator("#dprev")
    .setInputFiles({ name: "page1.png", mimeType: "image/png", buffer: png });
  await mp.locator("#dfinal").setInputFiles({
    name: "khata.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"),
  });
  await mp.getByLabel("Note to student").fill("All 13 pages done, diagrams labelled.");
  await mp.getByRole("button", { name: "Submit delivery" }).click();
  await expect(mp.getByText("Delivery submitted")).toBeVisible();

  // The student approves; EduKhata closes the order; the mentor's 80% becomes available.
  await p.goto(`/student/orders/${orderId}`);
  await p.getByRole("button", { name: "Approve work" }).click();
  await p.getByRole("button", { name: "Approve & release payment" }).click();
  await expect(p.getByText("Work approved")).toBeVisible();
  await ap.goto(`/admin/orders/${orderId}`);
  await ap.getByRole("button", { name: "Close order" }).click();
  await expect(ap.getByText("Order closed")).toBeVisible();
  await mp.goto("/mentor/earnings");
  await expect(mp.getByText("৳520").first()).toBeVisible();

  // The student's invoice exists for the verified payment.
  await p.goto("/student/payments");
  await p.getByRole("main").getByRole("link", { name: "Invoice", exact: true }).first().click();
  await expect(p.getByText("Total paid")).toBeVisible();
  await expect(p.getByText("৳650").first()).toBeVisible();

  // Payout: the mentor asks, the accountant approves, and a second person must send it.
  await mp.goto("/mentor/payouts");
  await mp.getByLabel("Amount (৳)").fill("520");
  await mp.getByLabel("Mobile number").fill("01922222222");
  await mp.getByRole("button", { name: "Request payout" }).click();
  await expect(mp.getByText("Your request is with the accounts team.")).toBeVisible();
  await ap.goto("/accountant/payouts");
  const row = ap.getByRole("row").filter({ hasText: `Nadia ${suffix}` });
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(ap.getByText("Payout approved")).toBeVisible();
  await row.getByRole("button", { name: "Mark paid" }).click();
  await ap.getByLabel("Transfer reference").fill("PAYOUT12345");
  await ap.getByRole("button", { name: "Confirm" }).click();
  await expect(ap.getByText("A second person must send the payout")).toBeVisible();

  // The ledger stays balanced throughout.
  await ap.goto("/accountant");
  await expect(ap.getByText("balanced", { exact: true })).toBeVisible();
});

test("the API refuses cross-site writes and unauthenticated admin calls", async ({ request }) => {
  const evil = await request.post("/api/me/onboarding", {
    headers: { origin: "https://evil.example" },
    data: { kind: "guardian" },
  });
  expect(evil.status()).toBe(403);
  expect((await request.get("/api/admin/users")).status()).toBe(401);
});
