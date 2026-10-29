import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { grant, guardian, signIn, student, useHarness, type Ctx } from "./harness.ts";

const ctx = useHarness();
type Who = { b: Awaited<ReturnType<typeof signIn>>["b"]; id?: string };

async function tokenOf(w: Who) {
  const r = await w.b.get("/me/chat-token");
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as { token: string; userId: string };
}

/** Calls the chat module the way the browser client does (bearer token + web Origin). */
async function chat(c: Ctx, token: string, method: string, url: string, body?: object) {
  return c.app.inject({
    method: method as "GET",
    url: `/chat${url}`,
    headers: {
      authorization: `Bearer ${token}`,
      ...(method !== "GET" ? { origin: "http://localhost:3200" } : {}),
    },
    ...(body ? { payload: body } : {}),
  });
}

async function supporter(name: string) {
  const s = await student(ctx, name);
  await grant(ctx, s.sub, "supporter");
  return s;
}

describe("chat (WAN chat module on EduKhata)", () => {
  it("issues session-bound tokens only to onboarded people; revoked sessions stop working", async () => {
    const fresh = await signIn(ctx, "Not Onboarded");
    expect((await fresh.b.get("/me/chat-token")).statusCode).toBe(403);
    expect((await ctx.app.inject({ method: "GET", url: "/me/chat-token" })).statusCode).toBe(401);

    const s = await student(ctx, "Token Student");
    const { token, userId } = await tokenOf(s);
    expect(userId).toBe(s.id);
    expect((await chat(ctx, token, "GET", "/conversations")).statusCode).toBe(200);
    expect((await chat(ctx, `${token}x`, "GET", "/conversations")).statusCode).toBe(401);

    // Signing out revokes the session, and with it every chat token it issued.
    await s.b.post("/auth/logout");
    expect((await chat(ctx, token, "GET", "/conversations")).statusCode).toBe(401);
  });

  it("marketplace rule: students, mentors and guardians can only message staff; no groups", async () => {
    const a = await student(ctx, "Chat Student A");
    const b = await student(ctx, "Chat Student B");
    const m = await student(ctx, "Chat Mentor");
    await grant(ctx, m.sub, "mentor");
    const g = await guardian(ctx, "Chat Guardian");
    const sup = await supporter("Support Shila");
    const [ta, tm, tg, ts] = await Promise.all([a, m, g, sup].map(tokenOf));

    // Search: non-staff only find the support team; no contact details are exposed.
    const found = (await chat(ctx, ta!.token, "GET", "/users/search?q=Chat")).json().items;
    expect(found).toEqual([]);
    const supportFound = (await chat(ctx, ta!.token, "GET", "/users/search?q=Shila")).json().items;
    expect(supportFound).toEqual([
      { id: sup.id, displayName: "Support Shila", handle: null, avatarUrl: null, status: "active" },
    ]);
    expect(
      (await chat(ctx, ts!.token, "GET", "/users/search?q=Chat Student")).json().items,
    ).toHaveLength(2);

    for (const t of [ta!, tm!]) {
      const r = await chat(ctx, t.token, "POST", "/conversations/direct", {
        userId: t === ta ? m.id : b.id,
      });
      expect(r.statusCode).toBe(403);
    }
    expect(
      (await chat(ctx, tg!.token, "POST", "/conversations/direct", { userId: a.id })).statusCode,
    ).toBe(403);
    const ok = await chat(ctx, ta!.token, "POST", "/conversations/direct", { userId: sup.id });
    expect(ok.statusCode).toBe(201);
    expect(
      (await chat(ctx, ts!.token, "POST", "/conversations/direct", { userId: g.id })).statusCode,
    ).toBe(201);

    const group = await chat(ctx, ts!.token, "POST", "/conversations/group", {
      title: "x",
      memberIds: [a.id, b.id],
    });
    expect(group.statusCode).toBe(403);
    expect((await chat(ctx, ta!.token, "GET", "/config")).json().groups).toBe(false);
  });

  it("a message notifies the recipient without its text", async () => {
    const a = await student(ctx, "Notified Student");
    const sup = await supporter("Support Rafi");
    const [ta, ts] = await Promise.all([a, sup].map(tokenOf));
    const conv = (
      await chat(ctx, ta!.token, "POST", "/conversations/direct", { userId: sup.id })
    ).json().conversation;
    for (const body of ["My payment is stuck", "TrxID 8N7A6B5C"]) {
      const r = await chat(ctx, ta!.token, "POST", `/conversations/${conv.id}/messages`, {
        clientMessageId: randomUUID(),
        kind: "text",
        body,
      });
      expect(r.statusCode).toBe(201);
    }
    await new Promise((r) => setTimeout(r, 50)); // notifier runs after commit
    const items = (await sup.b.get("/me/notifications"))
      .json()
      .items.filter((n: { type: string }) => n.type === "chat.message");
    expect(items).toHaveLength(1); // aggregated per conversation
    expect(items[0]).toMatchObject({
      link: `/messages?c=${conv.id}`,
      actorCount: 1,
      data: { sender: "Notified Student", preview: "" },
    });
    expect(JSON.stringify(items)).not.toContain("TrxID");
    expect(
      (await chat(ctx, ts!.token, "GET", `/conversations/${conv.id}/messages`)).json().items,
    ).toHaveLength(2);
  });

  it("uploads go through a signed URL and photos lose their EXIF data", async () => {
    const a = await student(ctx, "Photo Student");
    const { token } = await tokenOf(a);
    const jpeg = await sharp({
      create: { width: 40, height: 30, channels: 3, background: "#3366aa" },
    })
      .jpeg()
      .withExif({ IFD0: { Copyright: "secret-location-tag" } })
      .toBuffer();
    expect((await sharp(jpeg).metadata()).exif).toBeTruthy();

    const up = await chat(ctx, token, "POST", "/uploads", {
      kind: "image",
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      byteSize: jpeg.length,
    });
    expect(up.statusCode, up.body).toBe(201);
    const { attachmentId, uploadUrl } = up.json() as { attachmentId: string; uploadUrl: string };
    expect(uploadUrl.startsWith("/api/chat-files/")).toBe(true);
    const path = uploadUrl.replace(/^\/api/, "");

    // Tampered signature, wrong type or wrong size are refused.
    const put = (url: string, type: string, body: Buffer) =>
      ctx.app.inject({
        method: "PUT",
        url,
        headers: { "content-type": type, origin: "http://localhost:3200" },
        payload: body,
      });
    expect((await put(path.replace(/sig=[^&]+/, "sig=AAAA"), "image/jpeg", jpeg)).statusCode).toBe(
      403,
    );
    expect((await put(path, "image/png", jpeg)).statusCode).toBe(403);
    expect((await put(path, "image/jpeg", jpeg.subarray(1))).statusCode).toBe(403);
    expect((await put(path, "image/jpeg", jpeg)).statusCode).toBe(200);

    const done = await chat(ctx, token, "POST", `/uploads/${attachmentId}/complete`);
    expect(done.statusCode, done.body).toBe(200);
    expect(done.json().attachment.contentType).toBe("image/webp");

    const files = await readdir(ctx.config.chatUploadDir, { recursive: true, withFileTypes: true });
    const stored = files.filter((f) => f.isFile());
    expect(stored.length).toBeGreaterThan(0);
    for (const f of stored) {
      const buf = await readFile(join(f.parentPath, f.name));
      expect(buf.includes(Buffer.from("secret-location-tag"))).toBe(false);
    }
  });
});
