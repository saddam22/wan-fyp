"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { orderApi, uploadOrderFile } from "@/lib/order-api";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  ImageIcon,
  Lock,
  MessageSquare,
  Phone,
  RefreshCcw,
  Scale,
  Star,
  Truck,
  Upload,
  UserCog,
  Video,
} from "lucide-react";
import {
  formatDate,
  formatMoney,
  mockApi,
  splitCommission,
  type Order,
  type OrderFile,
  type OrderStatus,
} from "@edukhata/contracts";
import { Avatar, Button, Card, CardHeader, Field, KeyValue, PageHeader } from "@/components/ui";
import { Countdown, Modal, useToast } from "@/components/ui/client";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { LEVEL, ORDER_STATUS, subjectName, WORK_TYPE } from "@/lib/labels";
import { OrderStatusBadge } from "./OrdersTable";

export type Viewer = "student" | "mentor" | "admin" | "supporter" | "guardian";

const STAGES: { label: string; reached: OrderStatus[] }[] = [
  { label: "Placed", reached: [] },
  {
    label: "Paid",
    reached: [
      "matching",
      "assigned",
      "in_progress",
      "delivered",
      "revision_requested",
      "approved",
      "closed",
      "disputed",
    ],
  },
  {
    label: "Assigned",
    reached: [
      "assigned",
      "in_progress",
      "delivered",
      "revision_requested",
      "approved",
      "closed",
      "disputed",
    ],
  },
  {
    label: "In progress",
    reached: ["in_progress", "delivered", "revision_requested", "approved", "closed", "disputed"],
  },
  { label: "Delivered", reached: ["delivered", "revision_requested", "approved", "closed"] },
  { label: "Approved", reached: ["approved", "closed"] },
];

function FileRow({ f, locked, href }: { f: OrderFile; locked: boolean; href?: string }) {
  const Icon = f.kind === "image" ? ImageIcon : FileText;
  const toast = useToast();
  return (
    <li className="flex items-center gap-3 rounded-lg border border-line p-2.5">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          f.stage === "final"
            ? "bg-green-50 text-success"
            : f.stage === "preview"
              ? "bg-violet-50 text-violet-600"
              : "bg-slate-100 text-slate-600",
        )}
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{f.name}</p>
        <p className="text-[11px] text-muted">
          {f.stage === "preview"
            ? "Watermarked preview"
            : f.stage === "final"
              ? "Final file"
              : "Requirement"}{" "}
          · {f.sizeKb >= 1024 ? `${(f.sizeKb / 1024).toFixed(1)} MB` : `${f.sizeKb} KB`}
        </p>
      </div>
      {locked ? (
        <span
          className="flex items-center gap-1 text-[11px] font-semibold text-muted"
          title="Unlocks after you approve the work"
        >
          <Lock size={13} /> Locked
        </span>
      ) : href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener"
          className="rounded-lg p-2 text-[var(--color-accent)] hover:bg-[var(--color-accent-50)]"
          aria-label={`${f.stage === "preview" ? "Preview" : "Download"} ${f.name}`}
        >
          {f.stage === "preview" ? <Eye size={17} /> : <Download size={17} />}
        </a>
      ) : (
        <button
          className="rounded-lg p-2 text-[var(--color-accent)] hover:bg-[var(--color-accent-50)]"
          aria-label={`${f.stage === "preview" ? "Preview" : "Download"} ${f.name}`}
          onClick={() =>
            toast({
              tone: "info",
              title: f.stage === "preview" ? "Preview viewer" : "Download",
              body: "Files come from private storage via signed links in Phase 4.",
            })
          }
        >
          {f.stage === "preview" ? <Eye size={17} /> : <Download size={17} />}
        </button>
      )}
    </li>
  );
}

export function OrderDetail({
  order: initial,
  viewer,
  backHref,
  live = false,
}: {
  order: Order;
  viewer: Viewer;
  backHref: string;
  /** Signed in with WAN ID: every action goes to the EduKhata API. */
  live?: boolean;
}) {
  const { lang } = useT();
  const toast = useToast();
  const router = useRouter();
  const [order, setOrder] = useState(initial);
  const [modal, setModal] = useState<
    | null
    | "approve"
    | "revision"
    | "dispute"
    | "deliver"
    | "assign"
    | "review"
    | "cancel"
    | "escalate"
    | "close"
  >(null);
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState<File[]>([]);
  const [finals, setFinals] = useState<File[]>([]);
  const [cands, setCands] = useState<
    { id: string; name: string; activeOrders: number; capacity: number; score: number }[] | null
  >(null);
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [mentorPick, setMentorPick] = useState("");
  const [err, setErr] = useState("");

  const usedFree = order.revisions.filter((r) => !r.paid).length;
  const freeLeft = Math.max(0, order.freeRevisions - usedFree);
  const split = splitCommission(order.price.amountMinor, order.commissionRate);
  const running = ["assigned", "in_progress", "revision_requested", "matching"].includes(
    order.status,
  );
  const finalLocked =
    viewer === "student" || viewer === "guardian"
      ? !["approved", "closed"].includes(order.status)
      : false;

  function transition(status: OrderStatus, note: string, title: string) {
    setOrder((o) => ({
      ...o,
      status,
      timeline: [
        ...o.timeline,
        { at: new Date().toISOString(), status, note, actor: "You (demo)" },
      ],
    }));
    toast({
      tone: "success",
      title,
      body: "Demo only — not saved. Order transitions run server-side from Phase 4.",
    });
    setModal(null);
    setText("");
    setErr("");
  }

  const close = () => (setModal(null), setErr(""), setText(""), setPreviews([]), setFinals([]));

  /** Live action: the API does the transition and returns the updated order. */
  async function act(
    path: string,
    body: object | undefined,
    title: string,
    after?: (res: unknown) => string | void,
  ) {
    setBusy(true);
    setErr("");
    try {
      const res = await orderApi<Record<string, unknown>>(path, "POST", body);
      const next = (res.order ?? res) as Order;
      if (next && typeof next === "object" && "code" in next) setOrder(next);
      const extra = after?.(res);
      toast({ tone: "success", title, ...(extra ? { body: extra } : {}) });
      close();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const openAssign = async () => {
    setModal("assign");
    if (live) {
      setCands(null);
      setCands(
        await orderApi<NonNullable<typeof cands>>(`/admin/orders/${order.id}/candidates`).catch(
          () => [],
        ),
      );
    }
  };
  const mentorShare = order.payout ?? { ...order.price, amountMinor: split.mentorMinor };
  const platformShare = {
    ...order.price,
    amountMinor: order.price.amountMinor - mentorShare.amountMinor,
  };
  const canStudentAct = viewer === "student" && order.status === "delivered";

  const actions = (
    <>
      {canStudentAct && (
        <>
          <Button variant="success" onClick={() => setModal("approve")}>
            <CheckCircle2 size={16} /> Approve work
          </Button>
          <Button variant="outline" onClick={() => setModal("revision")}>
            <RefreshCcw size={16} /> Request revision
          </Button>
        </>
      )}
      {live &&
        (viewer === "student" || viewer === "guardian") &&
        (order.status === "awaiting_payment" ||
          order.revisions.some((r) => r.paymentStatus === "due")) && (
          <Link
            href={`/${viewer}/orders/${order.id}/pay`}
            className="inline-flex h-10 items-center rounded-[10px] bg-[var(--color-accent)] px-4 text-sm font-semibold text-white"
          >
            Pay now
          </Link>
        )}
      {viewer === "student" && order.status === "awaiting_payment" && !live && (
        <Link
          href="/student/payments/p1/pay"
          className="inline-flex h-10 items-center rounded-[10px] bg-[var(--color-accent)] px-4 text-sm font-semibold text-white"
        >
          Pay now
        </Link>
      )}
      {viewer === "student" && ["approved", "closed"].includes(order.status) && (
        <Button variant="outline" onClick={() => setModal("review")}>
          <Star size={16} /> Rate mentor
        </Button>
      )}
      {live && viewer === "mentor" && order.status === "assigned" && (
        <>
          <Button
            variant="accent"
            disabled={busy}
            onClick={() => act(`/mentor/orders/${order.id}/start`, undefined, "Work started")}
          >
            Start work
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              act(`/mentor/orders/${order.id}/release`, {}, "Order handed back", () => {
                router.push("/mentor/orders");
              })
            }
          >
            Hand back
          </Button>
        </>
      )}
      {viewer === "mentor" &&
        (live
          ? ["in_progress", "revision_requested"]
          : ["in_progress", "assigned", "revision_requested"]
        ).includes(order.status) && (
          <Button variant="accent" onClick={() => setModal("deliver")}>
            <Upload size={16} />{" "}
            {order.status === "revision_requested" ? "Submit revision" : "Deliver work"}
          </Button>
        )}
      {viewer === "admin" && !["closed", "cancelled", "refunded"].includes(order.status) && (
        <>
          <Button variant="accent" onClick={openAssign}>
            <UserCog size={16} /> {order.mentorId ? "Reassign" : "Assign mentor"}
          </Button>
          <Button variant="outline" onClick={() => setModal("cancel")}>
            {live ? "Cancel order" : "Cancel & refund"}
          </Button>
        </>
      )}
      {live && viewer === "admin" && order.status === "approved" && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => act(`/admin/orders/${order.id}/close`, undefined, "Order closed")}
        >
          Close order
        </Button>
      )}
      {viewer === "supporter" && !live && (
        <Button variant="accent" onClick={() => setModal("escalate")}>
          <AlertTriangle size={16} /> Escalate to admin
        </Button>
      )}
    </>
  );

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Orders", href: backHref }, { label: order.code }]}
        title={order.title}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} /> {order.code} · placed{" "}
            {formatDate(order.createdAt, lang, true)}
          </span>
        }
        actions={actions}
      />

      {viewer === "supporter" && (
        <p className="mb-4 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-900">
          Read-only view for support. Changes to orders and money are made by admins and
          accountants.
        </p>
      )}

      <Card className="mb-5 overflow-x-auto p-4">
        <ol className="flex min-w-[560px] items-center">
          {STAGES.map((s, i) => {
            const done = i === 0 || s.reached.includes(order.status);
            return (
              <li key={s.label} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                      done ? "bg-[var(--color-accent)] text-white" : "bg-slate-100 text-muted",
                    )}
                  >
                    {done ? <CheckCircle2 size={16} /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-semibold whitespace-nowrap",
                      done ? "text-ink" : "text-muted",
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <span
                    className={cn(
                      "mx-2 mb-5 h-0.5 flex-1 rounded",
                      STAGES[i + 1]!.reached.includes(order.status)
                        ? "bg-[var(--color-accent)]"
                        : "bg-slate-200",
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
        {["cancelled", "disputed", "refunded"].includes(order.status) && (
          <p
            className={cn(
              "mt-3 rounded-lg px-3 py-2 text-sm font-semibold",
              order.status === "disputed"
                ? "bg-rose-50 text-danger"
                : "bg-slate-100 text-slate-700",
            )}
          >
            {ORDER_STATUS[order.status].label}: {order.timeline.at(-1)?.note}
          </p>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Requirements" />
            <div className="space-y-4 p-5">
              <KeyValue
                items={[
                  ["Subject", subjectName(order.subject, lang)],
                  ["Level", LEVEL[order.level]],
                  ["Type", WORK_TYPE[order.workType]],
                  ["Pages / quantity", order.pages],
                  [
                    "Delivery",
                    order.deliveryMethod === "courier" ? "Courier (original) + scan" : "Digital",
                  ],
                  ["Deadline", formatDate(order.deadline, lang, true)],
                ]}
              />
              <div className="rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-line text-slate-700">
                {order.instructions}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Files"
              sub={
                finalLocked
                  ? "Final files unlock after you approve. Previews are watermarked."
                  : undefined
              }
            />
            <div className="grid gap-5 p-5 md:grid-cols-2">
              {(["requirement", "preview", "final"] as const).map((stage) => {
                const files = order.files.filter((f) => f.stage === stage);
                if (stage !== "requirement" && files.length === 0) return null;
                return (
                  <div key={stage} className={stage === "requirement" ? "md:col-span-2" : ""}>
                    <p className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">
                      {stage === "requirement"
                        ? "From student"
                        : stage === "preview"
                          ? "Previews"
                          : "Final delivery"}
                    </p>
                    {files.length === 0 ? (
                      <p className="text-sm text-muted">No files uploaded.</p>
                    ) : (
                      <ul className="space-y-2">
                        {files.map((f) => (
                          <FileRow
                            key={f.id}
                            f={f}
                            locked={stage === "final" && finalLocked}
                            {...(live ? { href: `/api/orders/${order.id}/files/${f.id}` } : {})}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              {!live && order.files.some((f) => f.stage === "preview" && f.kind === "image") && (
                <div
                  className="watermark ruled h-48 rounded-xl bg-white ring-1 ring-line md:col-span-2"
                  role="img"
                  aria-label="Watermarked preview"
                />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Revisions"
              sub={`${usedFree} of ${order.freeRevisions} free revisions used`}
            />
            {order.revisions.length === 0 ? (
              <p className="p-5 text-sm text-muted">No revisions requested.</p>
            ) : (
              <ul className="divide-y divide-line">
                {order.revisions.map((r) => (
                  <li key={r.n} className="p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">
                        Revision {r.n} {r.paid ? "(paid)" : "(free)"}
                      </p>
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          r.resolvedAt ? "text-success" : "text-warning",
                        )}
                      >
                        {r.resolvedAt
                          ? `Resolved ${formatDate(r.resolvedAt, lang)}`
                          : r.paymentStatus === "due"
                            ? `Waiting for payment (${formatMoney({ ...order.price, amountMinor: r.feeMinor ?? 0 }, lang)})`
                            : r.paymentStatus === "cancelled"
                              ? "Withdrawn"
                              : "Open"}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-700">{r.instructions}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      Requested {formatDate(r.requestedAt, lang, true)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <ol className="space-y-4 p-5">
              {[...order.timeline].reverse().map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className={cn(
                      "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                      i === 0 ? "bg-[var(--color-accent)]" : "bg-slate-300",
                    )}
                  />
                  <div>
                    <p className="text-sm font-semibold">{e.note}</p>
                    <p className="text-[11px] text-muted">
                      {e.actor} · {formatDate(e.at, lang, true)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <aside className="space-y-5">
          {running && (
            <Card className="p-5">
              <p className="mb-2 text-sm font-bold">Time to deadline</p>
              <Countdown deadline={order.deadline} label="Remaining" />
            </Card>
          )}

          <Card className="p-5">
            <p className="mb-3 text-sm font-bold">{viewer === "mentor" ? "Student" : "Mentor"}</p>
            {viewer === "mentor" || order.mentorName ? (
              <div className="flex items-center gap-3">
                <Avatar
                  name={viewer === "mentor" ? order.studentName : order.mentorName!}
                  hue={
                    viewer === "mentor" ? 210 : (mockApi.mentor(order.mentorId ?? "")?.hue ?? 200)
                  }
                  size={44}
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {viewer === "mentor" ? order.studentName : order.mentorName}
                  </p>
                  <p className="text-xs text-muted">
                    {viewer === "mentor" ? "Student" : live ? "Mentor" : "Verified mentor"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">
                {order.status === "matching"
                  ? "Offering to matching mentors…"
                  : "Assigned after payment is verified."}
              </p>
            )}
            {order.conversationId && viewer !== "guardian" && (
              <div className={cn("mt-4 grid gap-2", live ? "grid-cols-1" : "grid-cols-3")}>
                <Link
                  href={
                    viewer === "admin" || viewer === "supporter"
                      ? `/support-desk/chat?c=${order.conversationId}`
                      : `/${viewer}/messages?c=${order.conversationId}`
                  }
                  className="flex flex-col items-center gap-1 rounded-lg bg-slate-50 py-2 text-[11px] font-semibold hover:bg-[var(--color-accent-50)]"
                >
                  <MessageSquare size={17} />{" "}
                  {live ? "Open order chat (calls from the chat)" : "Chat"}
                </Link>
                {!live && (
                  <button
                    onClick={() =>
                      toast({
                        tone: "info",
                        title: "Audio call",
                        body: "1:1 calls use the WAN calling module (Phase 3). Calls are not recorded.",
                      })
                    }
                    className="flex flex-col items-center gap-1 rounded-lg bg-slate-50 py-2 text-[11px] font-semibold hover:bg-[var(--color-accent-50)]"
                  >
                    <Phone size={17} /> Call
                  </button>
                )}
                {!live && (
                  <button
                    onClick={() =>
                      toast({
                        tone: "info",
                        title: "Video call",
                        body: "1:1 calls use the WAN calling module (Phase 3). Calls are not recorded.",
                      })
                    }
                    className="flex flex-col items-center gap-1 rounded-lg bg-slate-50 py-2 text-[11px] font-semibold hover:bg-[var(--color-accent-50)]"
                  >
                    <Video size={17} /> Video
                  </button>
                )}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <p className="mb-3 text-sm font-bold">Payment</p>
            <dl className="space-y-2 text-sm">
              {viewer === "mentor" ? (
                <>
                  <div className="flex justify-between">
                    <dt className="text-muted">Order amount</dt>
                    <dd>{formatMoney(order.price, lang)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">
                      Platform fee ({Math.round(order.commissionRate * 100)}%)
                    </dt>
                    <dd>−{formatMoney(platformShare, lang)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line pt-2 font-bold">
                    <dt>Your earnings</dt>
                    <dd>{formatMoney(mentorShare, lang)}</dd>
                  </div>
                  <p className="text-[11px] text-muted">Available after the student approves.</p>
                </>
              ) : viewer === "admin" ? (
                <>
                  <div className="flex justify-between">
                    <dt className="text-muted">Paid by student</dt>
                    <dd>{formatMoney(order.price, lang)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">
                      Commission ({Math.round(order.commissionRate * 100)}%)
                    </dt>
                    <dd>{formatMoney(platformShare, lang)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Mentor share</dt>
                    <dd>{formatMoney(mentorShare, lang)}</dd>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between font-bold">
                    <dt>Total</dt>
                    <dd>{formatMoney(order.price, lang)}</dd>
                  </div>
                  <p className="text-[11px] text-muted">
                    {order.status === "awaiting_payment"
                      ? "Not paid yet."
                      : "Held by EduKhata until you approve the work."}
                  </p>
                </>
              )}
            </dl>
          </Card>

          {order.deliveryMethod === "courier" && (
            <Card className="flex gap-3 p-5 text-sm">
              <Truck size={20} className="text-[var(--color-accent)]" />
              <div>
                <p className="font-semibold">Courier delivery</p>
                <p className="text-xs text-muted">
                  Original khata is posted after the scanned preview is approved. Tracking number
                  appears here.
                </p>
              </div>
            </Card>
          )}

          {order.dispute && (
            <Card className="p-5 text-sm" data-testid="dispute">
              <p className="mb-1 flex items-center gap-2 font-bold">
                <Scale size={16} /> Dispute {order.dispute.status === "open" ? "open" : "resolved"}
              </p>
              <p className="text-slate-700">{order.dispute.reason}</p>
              {order.dispute.resolutionNote && (
                <p className="mt-2 text-xs text-muted">Decision: {order.dispute.resolutionNote}</p>
              )}
            </Card>
          )}

          {(viewer === "student" || (live && viewer === "mentor")) &&
            (live
              ? ["assigned", "delivered", "in_progress", "revision_requested", "approved"]
              : ["delivered", "in_progress", "revision_requested"]
            ).includes(order.status) && (
              <button
                onClick={() => setModal("dispute")}
                className="flex w-full items-center justify-center gap-2 text-xs font-semibold text-muted hover:text-danger"
              >
                <Scale size={14} /> Problem with this order? Open a dispute
              </button>
            )}
        </aside>
      </div>

      <Modal
        open={modal === "approve"}
        onClose={close}
        title="Approve this work?"
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="success"
              disabled={busy}
              onClick={() =>
                live
                  ? act(`/orders/${order.id}/approve`, undefined, "Work approved")
                  : transition(
                      "approved",
                      "Approved by student — mentor earnings released",
                      "Work approved",
                    )
              }
            >
              Approve & release payment
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          Approving unlocks the final files and releases the mentor&apos;s share (
          {formatMoney(mentorShare, lang)}). You can&apos;t request revisions afterwards.
        </p>
      </Modal>

      <Modal
        open={modal === "revision"}
        onClose={close}
        title="Request a revision"
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={busy}
              onClick={() => {
                if (text.trim().length < 15)
                  return setErr("Explain what needs to change (at least 15 characters)");
                if (live)
                  return void act(
                    `/orders/${order.id}/revisions`,
                    { instructions: text },
                    "Revision requested",
                    (res) =>
                      (res as { paymentDue?: boolean }).paymentDue
                        ? "This revision is beyond the free ones: it goes to the mentor after payment."
                        : undefined,
                  );
                setOrder((o) => ({
                  ...o,
                  revisions: [
                    ...o.revisions,
                    {
                      n: o.revisions.length + 1,
                      requestedAt: new Date().toISOString(),
                      instructions: text,
                      paid: freeLeft === 0,
                    },
                  ],
                }));
                transition(
                  "revision_requested",
                  `Revision ${order.revisions.length + 1} requested${freeLeft === 0 ? " (paid)" : " (free)"}`,
                  "Revision requested",
                );
              }}
            >
              {freeLeft > 0 ? "Send revision request" : "Request paid revision"}
            </Button>
          </>
        }
      >
        <p
          className={cn(
            "mb-3 rounded-lg px-3 py-2 text-sm",
            freeLeft > 0 ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900",
          )}
        >
          {freeLeft > 0
            ? `${freeLeft} free revision${freeLeft > 1 ? "s" : ""} left.`
            : "Free revisions used. An extra revision has a small fee set by admins."}
        </p>
        <Field label="What should the mentor change?" required htmlFor="rev" error={err}>
          <textarea
            id="rev"
            rows={5}
            className="input"
            aria-invalid={!!err}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
      </Modal>

      <Modal
        open={modal === "dispute"}
        onClose={close}
        title="Open a dispute"
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                text.trim().length < 20
                  ? setErr("Describe the problem (at least 20 characters)")
                  : live
                    ? act(`/orders/${order.id}/disputes`, { reason: text }, "Dispute opened")
                    : transition("disputed", "Dispute opened by student", "Dispute opened")
              }
            >
              Open dispute
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-700">
          An EduKhata admin will review the order, files and chat. The payment stays on hold until a
          decision is made.
        </p>
        <Field label="What went wrong?" required htmlFor="dsp" error={err}>
          <textarea
            id="dsp"
            rows={5}
            className="input"
            aria-invalid={!!err}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
      </Modal>

      <Modal
        open={modal === "review"}
        onClose={close}
        title="Rate your mentor"
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={busy}
              onClick={() =>
                live
                  ? act(
                      `/orders/${order.id}/review`,
                      { rating, text },
                      "Review submitted",
                      (res) =>
                        (res as { status?: string }).status === "pending"
                          ? "It mentions contact details, so a moderator checks it first."
                          : undefined,
                    )
                  : (setModal(null),
                    toast({
                      tone: "success",
                      title: "Review submitted",
                      body: "Reviews are checked by moderators before publishing (demo).",
                    }))
              }
            >
              Submit review
            </Button>
          </>
        }
      >
        <div className="mb-3 flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              role="radio"
              aria-checked={rating === i}
              aria-label={`${i} stars`}
              onClick={() => setRating(i)}
            >
              <Star
                size={28}
                className={i <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}
              />
            </button>
          ))}
        </div>
        <textarea
          rows={4}
          className="input"
          placeholder="How was the work, communication and delivery?"
          aria-label="Review"
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {err && <p className="mt-2 text-xs text-danger">{err}</p>}
      </Modal>

      <Modal
        open={modal === "deliver"}
        onClose={close}
        title={order.status === "revision_requested" ? "Submit revised work" : "Deliver work"}
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={busy}
              onClick={async () => {
                if (text.trim().length < 5) return setErr("Add a short note for the student");
                if (!live)
                  return transition(
                    "delivered",
                    order.status === "revision_requested" ? "Revised delivery" : "Delivered",
                    "Delivery submitted",
                  );
                if (!previews.length || !finals.length)
                  return setErr("Add at least one preview image and the final files");
                setBusy(true);
                try {
                  for (const f of previews) await uploadOrderFile(order.id, "preview", f);
                  for (const f of finals) await uploadOrderFile(order.id, "final", f);
                } catch (e) {
                  setBusy(false);
                  return setErr((e as Error).message);
                }
                await act(
                  `/mentor/orders/${order.id}/deliver`,
                  { note: text },
                  "Delivery submitted",
                );
              }}
            >
              Submit delivery
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {live ? (
            <>
              <Field label="Preview images (watermarked automatically)" required htmlFor="dprev">
                <input
                  id="dprev"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="text-sm"
                  onChange={(e) => setPreviews([...(e.target.files ?? [])])}
                />
              </Field>
              <Field label="Final files (unlock after approval)" required htmlFor="dfinal">
                <input
                  id="dfinal"
                  type="file"
                  multiple
                  accept="application/pdf,image/jpeg,image/png,image/webp,.doc,.docx,.zip"
                  className="text-sm"
                  onChange={(e) => setFinals([...(e.target.files ?? [])])}
                />
              </Field>
            </>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line bg-slate-50 p-5 text-center text-sm">
              <Upload size={22} className="text-[var(--color-accent)]" />
              Upload preview (watermarked automatically) and final files
              <input type="file" multiple className="sr-only" accept="application/pdf,image/*" />
            </label>
          )}
          <Field label="Note to student" required htmlFor="dnote" error={err}>
            <textarea
              id="dnote"
              rows={3}
              className="input"
              aria-invalid={!!err}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={modal === "assign"}
        onClose={close}
        title={order.mentorId ? "Reassign order" : "Assign a mentor manually"}
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={busy}
              onClick={() => {
                if (live)
                  return mentorPick
                    ? void act(
                        `/admin/orders/${order.id}/assign`,
                        { mentorId: mentorPick, note: text },
                        "Mentor assigned",
                      )
                    : setErr("Choose a mentor");
                const m = mockApi.mentor(mentorPick);
                if (!m) return setErr("Choose a mentor");
                setOrder((o) => ({ ...o, mentorId: m.id, mentorName: m.name }));
                transition(
                  "assigned",
                  `Manually assigned to ${m.name} by admin`,
                  "Mentor assigned",
                );
              }}
            >
              Assign
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          Only mentors with this subject and free capacity are listed. The server assigns atomically
          — if another mentor accepted meanwhile, this fails.
        </p>
        <Field label="Mentor" required htmlFor="mpick" error={err}>
          <select
            id="mpick"
            className="input"
            value={mentorPick}
            onChange={(e) => setMentorPick(e.target.value)}
          >
            <option value="">{live && !cands ? "Loading…" : "Choose…"}</option>
            {live &&
              cands?.map((m) => (
                <option key={m.id} value={m.id} disabled={m.id === order.mentorId}>
                  {m.name} — {m.activeOrders}/{m.capacity} active · score {m.score}
                </option>
              ))}
            {!live &&
              mockApi.mentors({ subject: order.subject }).map((m) => (
                <option
                  key={m.id}
                  value={m.handle}
                  disabled={!m.available || m.id === order.mentorId}
                >
                  {m.name} — {m.activeOrders}/{m.capacity} active{!m.available ? " (full)" : ""}
                </option>
              ))}
          </select>
        </Field>
        {live && cands?.length === 0 && (
          <p className="mt-2 text-xs text-muted">
            No mentor with this subject and free capacity right now.
          </p>
        )}
        {live && (
          <Field label="Note (kept in the order history)" htmlFor="anote">
            <input
              id="anote"
              className="input"
              maxLength={300}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
        )}
      </Modal>

      <Modal
        open={modal === "cancel"}
        onClose={close}
        title="Cancel order and refund?"
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Keep order
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                live
                  ? text.trim().length < 3
                    ? setErr("Give a reason")
                    : act(`/orders/${order.id}/cancel`, { reason: text }, "Order cancelled")
                  : transition(
                      "refunded",
                      "Cancelled by admin — refund queued for accountant",
                      "Order cancelled",
                    )
              }
            >
              Cancel & refund
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          {live
            ? "The order is cancelled and the mentor (if any) is told. If it was paid, the refund is handled by the accounts team. Logged in the audit trail."
            : `A refund of ${formatMoney(order.price, lang)} is created for the accounts team to pay out. This is logged in the audit trail.`}
        </p>
        {live && (
          <Field label="Reason" required htmlFor="creason" error={err}>
            <input
              id="creason"
              className="input"
              maxLength={300}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
        )}
      </Modal>

      <Modal
        open={modal === "escalate"}
        onClose={close}
        title="Escalate to admin"
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={() =>
                text.trim().length < 10
                  ? setErr("Add a reason")
                  : (setModal(null),
                    toast({
                      tone: "success",
                      title: "Escalated to admin",
                      body: "Demo only — not saved.",
                    }))
              }
            >
              Escalate
            </Button>
          </>
        }
      >
        <Field label="Reason" required htmlFor="esc" error={err}>
          <textarea
            id="esc"
            rows={4}
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
      </Modal>
    </div>
  );
}
