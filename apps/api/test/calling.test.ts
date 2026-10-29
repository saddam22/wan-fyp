import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { attachCallGateway } from "../src/calling/module.ts";
import type { Deps } from "../src/deps.ts";
import { grant, guardian, student, useHarness } from "./harness.ts";

const ctx = useHarness();
let url = "";
let gateway: { close(): Promise<void> } | null = null;

beforeAll(async () => {
  const deps = (ctx.app as unknown as { edkDeps: Deps }).edkDeps;
  await ctx.app.listen({ port: 0, host: "127.0.0.1" });
  gateway = attachCallGateway(ctx.app.server, ctx.db, deps.chat, deps.calling, ctx.config.webUrl);
  url = `ws://127.0.0.1:${(ctx.app.server.address() as AddressInfo).port}/calls/ws`;
});
afterAll(async () => gateway?.close());

type Msg = {
  type: string;
  requestId?: string;
  ok?: boolean;
  data?: unknown;
  error?: { code: string };
  call?: { id: string; status: string };
};

/** A signalling client like @agg/calling-client's, minus WebRTC. */
async function connect(token: string) {
  const ws = new WebSocket(url);
  const inbox: Msg[] = [];
  const waiters: [(m: Msg) => boolean, (m: Msg) => void][] = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(String(e.data)) as Msg;
    const i = waiters.findIndex(([f]) => f(m));
    if (i >= 0) waiters.splice(i, 1)[0]![1](m);
    else inbox.push(m);
  });
  const next = (f: (m: Msg) => boolean, ms = 3000) =>
    new Promise<Msg>((resolve, reject) => {
      const i = inbox.findIndex(f);
      if (i >= 0) return resolve(inbox.splice(i, 1)[0]!);
      const t = setTimeout(() => reject(new Error("timeout")), ms);
      waiters.push([f, (m) => (clearTimeout(t), resolve(m))]);
    });
  await new Promise((r, j) => (ws.addEventListener("open", r), ws.addEventListener("error", j)));
  ws.send(JSON.stringify({ type: "auth", token }));
  const first = await next((m) => m.type === "ready" || m.type === "error");
  const request = async (msg: object) => {
    const requestId = randomUUID();
    ws.send(JSON.stringify({ ...msg, requestId }));
    return next((m) => m.type === "ack" && m.requestId === requestId);
  };
  return { ws, first, next, request, close: () => ws.close() };
}

const tokenOf = async (s: { b: { get(u: string): Promise<{ json(): unknown }> } }) =>
  ((await s.b.get("/me/chat-token")).json() as { token: string }).token;

describe("calls (WAN calling module on EduKhata)", () => {
  it("refuses bad tokens", async () => {
    const c = await connect("nope.nope");
    expect(c.first.type).toBe("error");
    c.close();
  });

  it("students can call support, not each other; a missed call becomes a notification", async () => {
    const a = await student(ctx, "Caller Student");
    const b = await student(ctx, "Other Student");
    const sup = await student(ctx, "Support Call Desk");
    await grant(ctx, sup.sub, "supporter");
    const ca = await connect(await tokenOf(a));
    expect(ca.first).toMatchObject({ type: "ready", userId: a.id });

    const denied = await ca.request({ type: "call.invite", calleeId: b.id, media: "audio" });
    expect(denied.ok).toBe(false);

    const cs = await connect(await tokenOf(sup));
    const invite = await ca.request({ type: "call.invite", calleeId: sup.id, media: "video" });
    expect(invite.ok, JSON.stringify(invite)).toBe(true);
    const incoming = await cs.next((m) => m.type === "call.incoming");
    const callId = (incoming as { call: { id: string } }).call.id;

    // The caller gives up before support answers → missed call for support.
    expect((await ca.request({ type: "call.cancel", callId })).ok).toBe(true);
    await new Promise((r) => setTimeout(r, 100));
    const n = (await sup.b.get("/me/notifications"))
      .json()
      .items.find((x: { type: string }) => x.type === "call.missed");
    expect(n).toMatchObject({
      link: "/messages",
      data: { caller: "Caller Student", media: "video" },
    });
    ca.close();
    cs.close();
  });

  it("guardians can call support; signing out ends call access", async () => {
    const g = await guardian(ctx, "Calling Guardian");
    const sup = await student(ctx, "Support Two");
    await grant(ctx, sup.sub, "supporter");
    const token = await tokenOf(g);
    const cg = await connect(token);
    expect((await cg.request({ type: "call.invite", calleeId: sup.id, media: "audio" })).ok).toBe(
      true,
    );
    cg.close();
    await g.b.post("/auth/logout");
    const again = await connect(token);
    expect(again.first.type).toBe("error");
    again.close();
  });
});
