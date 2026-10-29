"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  BadgeCheck,
  CheckCircle2,
  Clock,
  FileUp,
  ImagePlus,
  Lock,
  Plus,
  Rocket,
  Share2,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  bdt,
  fixtures,
  formatDate,
  formatMoney,
  type Offer,
  type PortfolioItem,
  type Service,
  type SkillTest,
} from "@edukhata/contracts";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Progress,
} from "@/components/ui";
import {
  CopyButton,
  Countdown,
  DataTable,
  Modal,
  useDemoToast,
  useToast,
} from "@/components/ui/client";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { subjectName, WORK_TYPE } from "@/lib/labels";
import { orderApi } from "@/lib/order-api";

export function AvailabilityToggle() {
  const [on, setOn] = useState(true);
  const demo = useDemoToast();
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => (
        setOn(!on),
        demo(on ? "You're now unavailable — no new offers" : "You're available for new offers")
      )}
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ring-1",
        on ? "bg-green-50 text-success ring-green-200" : "bg-slate-100 text-muted ring-line",
      )}
    >
      <span
        className={cn(
          "relative h-4 w-7 rounded-full transition",
          on ? "bg-success" : "bg-slate-300",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
            on ? "left-3.5" : "left-0.5",
          )}
        />
      </span>
      {on ? "Available for orders" : "Not available"}
    </button>
  );
}

/**
 * Time-limited order offers. Acceptance is decided by the server (first eligible
 * acceptance wins, atomically); offer `of3` simulates losing that race.
 */
export function OffersList({
  offers: initial,
  compact,
  live = false,
}: {
  offers: (Offer & { instructions?: string })[];
  compact?: boolean;
  /** Accept/decline through the API (first valid acceptance wins on the server). */
  live?: boolean;
}) {
  const router = useRouter();
  const { lang } = useT();
  const toast = useToast();
  const [offers, setOffers] = useState(initial);
  const [reject, setReject] = useState<Offer | null>(null);
  const [reason, setReason] = useState("busy");

  async function accept(o: Offer) {
    if (live) {
      try {
        await orderApi(`/mentor/offers/${o.id}/accept`, "POST");
        toast({
          tone: "success",
          title: `${o.orderCode} is yours`,
          body: "Start when you're ready.",
        });
        router.push(`/mentor/orders/${o.orderId}`);
      } catch (e) {
        toast({ tone: "warning", title: "Not available any more", body: (e as Error).message });
      }
      setOffers((xs) => xs.filter((x) => x.id !== o.id));
      return;
    }
    if (o.id === "of3") {
      toast({
        tone: "warning",
        title: "Another mentor accepted first",
        body: `${o.orderCode} was assigned a moment ago. Only one mentor can take an order.`,
      });
    } else {
      toast({
        tone: "success",
        title: `${o.orderCode} accepted`,
        body: "Demo only — not saved. In production the server confirms the assignment atomically.",
      });
    }
    setOffers((xs) => xs.filter((x) => x.id !== o.id));
  }

  if (offers.length === 0)
    return (
      <EmptyState
        title="No new requests"
        body="Offers matching your subjects and capacity appear here. Keep your availability on."
      />
    );
  return (
    <>
      <ul className="divide-y divide-line">
        {offers.map((o) => (
          <li key={o.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{o.title}</p>
                <Badge tone="violet">
                  {live ? Math.round(o.matchScore * 100) : o.matchScore}% match
                </Badge>
              </div>
              <p className="text-xs text-muted">
                {o.orderCode} · {subjectName(o.subject, lang)} · {WORK_TYPE[o.workType]} · {o.pages}{" "}
                pages · due {formatDate(o.deadline, lang, true)}
              </p>
              {o.instructions && (
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">{o.instructions}</p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-bold">{formatMoney(o.payout, lang)}</p>
                <p className="text-[11px] text-muted">your share</p>
              </div>
              <div className="text-center">
                <Countdown deadline={o.expiresAt} compact />
                <p className="text-[10px] text-muted">offer expires</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="success" onClick={() => accept(o)}>
                  <CheckCircle2 size={14} /> Accept
                </Button>
                {!compact && (
                  <Button size="sm" variant="outline" onClick={() => setReject(o)}>
                    Decline
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Modal
        open={!!reject}
        onClose={() => setReject(null)}
        title={`Decline ${reject?.orderCode}?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setReject(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const o = reject!;
                if (live)
                  await orderApi(`/mentor/offers/${o.id}/decline`, "POST").catch(() => undefined);
                setOffers((xs) => xs.filter((x) => x.id !== o.id));
                setReject(null);
                toast({
                  tone: "info",
                  title: "Offer declined",
                  body: "It moves to the next matching mentor.",
                });
              }}
            >
              Decline
            </Button>
          </>
        }
      >
        <Field label="Reason (helps matching)" htmlFor="rj">
          <select
            id="rj"
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="busy">Too busy right now</option>
            <option value="subject">Outside my expertise</option>
            <option value="deadline">Deadline too short</option>
            <option value="price">Price too low</option>
          </select>
        </Field>
      </Modal>
    </>
  );
}

export function ServicesManager({ services: initial }: { services: Service[] }) {
  const { lang } = useT();
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    title: "",
    subject: "biology",
    workType: "practical_khata",
    price: "50",
    discount: "0",
    days: "3",
  });
  const [err, setErr] = useState<Record<string, string>>({});
  return (
    <Card>
      <DataTable
        rows={rows}
        rowKey={(s) => s.id}
        searchText={(s) => s.title}
        toolbar={
          <Button variant="accent" onClick={() => setOpen(true)}>
            <Plus size={16} /> New service
          </Button>
        }
        columns={[
          {
            key: "t",
            header: "Service",
            cell: (s) => (
              <span>
                <span className="block font-semibold">{s.title}</span>
                <span className="text-[11px] text-muted">
                  {subjectName(s.subject, lang)} · {WORK_TYPE[s.workType]}
                </span>
              </span>
            ),
          },
          {
            key: "p",
            header: "Price / page",
            cell: (s) => (
              <span>
                {formatMoney(s.pricePerPage, lang)}
                {s.discountPct > 0 && (
                  <Badge tone="green" className="ml-1">
                    −{s.discountPct}%
                  </Badge>
                )}
              </span>
            ),
            sort: (s) => s.pricePerPage.amountMinor,
          },
          { key: "d", header: "Delivery", cell: (s) => `${s.deliveryDays} days` },
          { key: "o", header: "Orders", cell: (s) => s.orders, sort: (s) => s.orders },
          {
            key: "a",
            header: "Active",
            cell: (s) => (
              <button
                role="switch"
                aria-checked={s.active}
                aria-label={`${s.title} active`}
                onClick={(e) => (
                  e.stopPropagation(),
                  setRows((rs) => rs.map((r) => (r.id === s.id ? { ...r, active: !r.active } : r)))
                )}
                className={cn(
                  "relative h-5 w-9 rounded-full",
                  s.active ? "bg-success" : "bg-slate-300",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
                    s.active ? "left-4.5" : "left-0.5",
                  )}
                />
              </button>
            ),
          },
        ]}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New service"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                const e: Record<string, string> = {};
                if (f.title.trim().length < 8) e.title = "Title must be at least 8 characters";
                if (!(Number(f.price) >= 10 && Number(f.price) <= 5000))
                  e.price = "Price per page must be ৳10–৳5,000";
                if (!(Number(f.discount) >= 0 && Number(f.discount) <= 50))
                  e.discount = "Discount 0–50%";
                setErr(e);
                if (Object.keys(e).length) return;
                setRows((rs) => [
                  {
                    id: `n${rs.length}`,
                    mentorId: "m1",
                    title: f.title,
                    subject: f.subject,
                    workType: f.workType as Service["workType"],
                    pricePerPage: bdt(Number(f.price)),
                    discountPct: Number(f.discount),
                    deliveryDays: Number(f.days),
                    active: true,
                    orders: 0,
                  },
                  ...rs,
                ]);
                setOpen(false);
                toast({
                  tone: "success",
                  title: "Service created",
                  body: "Demo only — not saved.",
                });
              }}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" required htmlFor="sv-t" error={err.title}>
            <input
              id="sv-t"
              className="input"
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subject" htmlFor="sv-s">
              <select
                id="sv-s"
                className="input"
                value={f.subject}
                onChange={(e) => setF({ ...f, subject: e.target.value })}
              >
                {fixtures.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type" htmlFor="sv-w">
              <select
                id="sv-w"
                className="input"
                value={f.workType}
                onChange={(e) => setF({ ...f, workType: e.target.value })}
              >
                {Object.entries(WORK_TYPE).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Price per page (৳)" required htmlFor="sv-p" error={err.price}>
              <input
                id="sv-p"
                type="number"
                className="input"
                value={f.price}
                onChange={(e) => setF({ ...f, price: e.target.value })}
              />
            </Field>
            <Field label="Discount %" htmlFor="sv-d" error={err.discount}>
              <input
                id="sv-d"
                type="number"
                className="input"
                value={f.discount}
                onChange={(e) => setF({ ...f, discount: e.target.value })}
              />
            </Field>
            <Field label="Delivery days" htmlFor="sv-dd">
              <input
                id="sv-dd"
                type="number"
                min={1}
                className="input"
                value={f.days}
                onChange={(e) => setF({ ...f, days: e.target.value })}
              />
            </Field>
          </div>
          <p className="text-xs text-muted">
            You receive 80% of the order price after the student approves.
          </p>
        </div>
      </Modal>
    </Card>
  );
}

export function PortfolioManager({ items: initial }: { items: PortfolioItem[] }) {
  const [items, setItems] = useState(initial);
  const toast = useToast();
  const KIND = {
    handwriting: "Handwriting",
    practical_khata: "Practical khata",
    drawing: "Drawing",
    diagram: "Diagram",
    digital: "Digital",
  };
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-line bg-white p-4 text-center text-sm text-muted hover:border-[var(--color-accent)]">
        <ImagePlus size={26} className="text-[var(--color-accent)]" />
        Add samples
        <span className="text-[11px]">JPG, PNG or PDF · watermarked on your public profile</span>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,application/pdf"
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            setItems((xs) => [
              ...files.map((f, i) => ({
                id: `u${Date.now()}${i}`,
                title: f.name,
                kind: "handwriting" as const,
                subject: "biology",
                hue: 200,
              })),
              ...xs,
            ]);
            if (files.length)
              toast({
                tone: "success",
                title: `${files.length} sample(s) added`,
                body: "Demo only — not uploaded.",
              });
          }}
        />
      </label>
      {items.map((p) => (
        <Card key={p.id} className="overflow-hidden">
          <div className="ruled watermark relative h-36 bg-white">
            <span
              className="absolute inset-6 rounded-full opacity-30"
              style={{
                background: `radial-gradient(circle, hsl(${p.hue} 70% 55%), transparent 70%)`,
              }}
            />
          </div>
          <div className="flex items-center gap-2 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.title}</p>
              <p className="text-[11px] text-muted">
                {KIND[p.kind]} · {subjectName(p.subject)}
              </p>
            </div>
            <button
              aria-label={`Delete ${p.title}`}
              onClick={() => setItems((xs) => xs.filter((x) => x.id !== p.id))}
              className="text-muted hover:text-danger"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function QrProfileCard({
  url,
  name,
  subject,
  hue,
}: {
  url: string;
  name: string;
  subject: string;
  hue: number;
}) {
  const [svg, setSvg] = useState("");
  const demo = useDemoToast();
  useEffect(() => {
    QRCode.toString(url, {
      type: "svg",
      margin: 1,
      color: { dark: "#0b1b3f", light: "#ffffff" },
    }).then(setSvg, () => setSvg(""));
  }, [url]);
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-mentor to-indigo-600 p-5 text-center text-white">
        <Avatar name={name} hue={hue} size={64} className="mx-auto ring-4 ring-white/30" />
        <p className="mt-2 font-bold">{name}</p>
        <p className="text-xs text-violet-100">{subject} mentor · EduKhata</p>
      </div>
      <div className="flex flex-col items-center gap-3 p-5">
        <div
          className="h-40 w-40 rounded-lg bg-white p-1 ring-1 ring-line"
          aria-label={`QR code for ${url}`}
          role="img"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="max-w-full truncate text-xs text-muted">{url}</p>
        <div className="flex gap-2">
          <CopyButton text={url} label="Copy link" />
          <button
            onClick={() => demo("Profile card downloaded")}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-accent)] ring-1 ring-line"
          >
            <Share2 size={13} /> Share card
          </button>
        </div>
      </div>
    </Card>
  );
}

const DOC_LABEL = {
  nid: "National ID",
  passport: "Passport",
  certificate: "Certificate",
  transcript: "Transcript",
  sample: "Handwriting sample",
} as const;
const DOC_STATUS = {
  verified: { label: "Verified", tone: "green" },
  under_review: { label: "Under review", tone: "amber" },
  rejected: { label: "Rejected", tone: "red" },
  missing: { label: "Not uploaded", tone: "gray" },
} as const;

export function VerificationDocs() {
  const toast = useToast();
  const [docs, setDocs] = useState<
    { type: keyof typeof DOC_LABEL; status: keyof typeof DOC_STATUS; note?: string }[]
  >([
    { type: "nid", status: "verified" },
    { type: "certificate", status: "verified" },
    {
      type: "transcript",
      status: "rejected",
      note: "Image is blurred — please upload a clear scan.",
    },
    { type: "sample", status: "verified" },
    { type: "passport", status: "missing" },
  ]);
  return (
    <Card>
      <CardHeader
        title="Documents"
        sub="Private: only the verification team can open these. Reviewed by a person — never auto-approved."
      />
      <ul className="divide-y divide-line">
        {docs.map((d) => (
          <li key={d.type} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                <Lock size={16} className="text-muted" />
              </span>
              <div>
                <p className="text-sm font-semibold">{DOC_LABEL[d.type]}</p>
                {d.note && <p className="text-xs text-danger">{d.note}</p>}
              </div>
            </div>
            <Badge tone={DOC_STATUS[d.status].tone}>{DOC_STATUS[d.status].label}</Badge>
            {d.status !== "verified" && (
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[10px] border border-line px-3 text-xs font-semibold hover:bg-slate-50">
                <FileUp size={14} /> {d.status === "missing" ? "Upload" : "Re-upload"}
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="sr-only"
                  onChange={(e) =>
                    e.target.files?.[0] &&
                    (setDocs((xs) =>
                      xs.map((x) =>
                        x.type === d.type ? { ...x, status: "under_review", note: undefined } : x,
                      ),
                    ),
                    toast({
                      tone: "success",
                      title: "Sent for review",
                      body: "Demo only — not uploaded.",
                    }))
                  }
                />
              </label>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function SkillTests({ tests }: { tests: SkillTest[] }) {
  const toast = useToast();
  const [start, setStart] = useState<SkillTest | null>(null);
  const tone = { passed: "green", failed: "red", available: "blue", locked: "gray" } as const;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tests.map((t) => (
          <Card key={t.id} className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <p className="font-bold">{subjectName(t.subject)}</p>
              <Badge tone={tone[t.status]}>
                {t.status === "available"
                  ? "Not taken"
                  : t.status[0]!.toUpperCase() + t.status.slice(1)}
              </Badge>
            </div>
            <p className="text-xs text-muted">
              {t.questions} questions · {t.minutes} min · pass mark {t.passMark}%
            </p>
            {t.score !== undefined && (
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span>Score</span>
                  <span className="font-semibold">{t.score}%</span>
                </div>
                <Progress value={t.score} tone={t.score >= t.passMark ? "green" : "amber"} />
              </div>
            )}
            <div className="mt-auto">
              {t.status === "available" && (
                <Button variant="accent" size="sm" onClick={() => setStart(t)}>
                  Start test
                </Button>
              )}
              {t.status === "failed" && (
                <p className="text-xs text-muted">Retake available in 14 days.</p>
              )}
              {t.status === "locked" && (
                <p className="text-xs text-muted">Add this subject to your profile to unlock.</p>
              )}
              {t.status === "passed" && (
                <p className="flex items-center gap-1 text-xs font-semibold text-success">
                  <BadgeCheck size={14} /> Skill badge earned
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>
      <Modal
        open={!!start}
        onClose={() => setStart(null)}
        title={`${start ? subjectName(start.subject) : ""} skill test`}
        footer={
          <>
            <Button variant="outline" onClick={() => setStart(null)}>
              Not now
            </Button>
            <Button
              variant="accent"
              onClick={() => (
                setStart(null),
                toast({
                  tone: "info",
                  title: "Test engine",
                  body: "Questions are served by the exam engine in Phase 6 (ICTSpark exam rules ported).",
                })
              )}
            >
              Begin
            </Button>
          </>
        }
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>
            {start?.questions} multiple-choice questions, {start?.minutes} minutes.
          </li>
          <li>Stay on this tab — leaving the page may end the test.</li>
          <li>You need {start?.passMark}% to earn the skill badge.</li>
        </ul>
      </Modal>
    </>
  );
}

/** Payout form. Live: posts to the API (minimum and balance are checked there too). */
export function PayoutRequest({
  availableMinor,
  live,
  minMinor = 50000,
}: {
  availableMinor: number;
  live?: boolean;
  minMinor?: number;
}) {
  const { lang } = useT();
  const toast = useToast();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bkash");
  const [account, setAccount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const MIN = minMinor / 100;
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const v = Number(amount);
        if (!Number.isFinite(v) || v < MIN)
          return setErr(`Minimum payout is ${formatMoney(bdt(MIN), lang)}`);
        if (v * 100 > availableMinor) return setErr("Amount is more than your available balance");
        if (live) {
          setBusy(true);
          try {
            await orderApi("/mentor/payouts", "POST", {
              amountMinor: Math.round(v * 100),
              method,
              account,
              ...(accountName.trim() ? { accountName: accountName.trim() } : {}),
            });
            setErr("");
            setAmount("");
            toast({ tone: "success", title: "Payout requested" });
            router.refresh();
          } catch (x) {
            setErr((x as Error).message);
          } finally {
            setBusy(false);
          }
          return;
        }
        setErr("");
        setAmount("");
        toast({
          tone: "success",
          title: "Payout requested",
          body: "Demo only — not saved. One request at a time; the accounts team approves it.",
        });
      }}
    >
      <Field
        label="Amount (৳)"
        required
        htmlFor="po-a"
        error={err}
        hint={`Available: ${formatMoney({ amountMinor: availableMinor, currency: "BDT" }, lang)} · minimum ${formatMoney(bdt(MIN), lang)}`}
      >
        <input
          id="po-a"
          type="number"
          min={MIN}
          className="input"
          aria-invalid={!!err}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <Field label="Send to" htmlFor="po-m">
        <select
          id="po-m"
          className="input"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          {live ? (
            <>
              <option value="bkash">bKash</option>
              <option value="nagad">Nagad</option>
              <option value="rocket">Rocket</option>
              <option value="bank">Bank</option>
            </>
          ) : (
            <>
              <option value="bkash">bKash · 017••••5678 (verified)</option>
              <option value="nagad">Nagad · add number in profile</option>
              <option value="bank">Bank · DBBL ••••2231</option>
            </>
          )}
        </select>
      </Field>
      {live && (
        <>
          <Field
            label={method === "bank" ? "Bank, branch and account number" : "Mobile number"}
            required
            htmlFor="po-acc"
          >
            <input
              id="po-acc"
              className="input"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder={method === "bank" ? "" : "01XXXXXXXXX"}
            />
          </Field>
          {method === "bank" && (
            <Field label="Account name" htmlFor="po-an">
              <input
                id="po-an"
                className="input"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </Field>
          )}
        </>
      )}
      <Button type="submit" variant="accent" className="w-full" disabled={busy}>
        Request payout
      </Button>
    </form>
  );
}

export function PromotePlans() {
  const toast = useToast();
  const plans = [
    {
      id: "boost7",
      name: "Profile Boost — 7 days",
      price: 299,
      desc: "Shown in the labelled “Featured” slot on search and the homepage.",
      period: "one-time",
    },
    {
      id: "pro-m",
      name: "Pro — Monthly",
      price: 499,
      desc: "Pro label, up to 10 active orders, priority support.",
      period: "/ month",
    },
    {
      id: "pro-y",
      name: "Pro — Yearly",
      price: 4990,
      desc: "Everything in Pro monthly, two months free.",
      period: "/ year",
    },
  ];
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
        Paid promotions are always labelled <b>Featured</b> or <b>Pro</b>. They never change your
        organic ranking and never give the <b>Verified</b> badge.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className="flex flex-col gap-3 p-5">
            <Rocket className="text-[var(--color-accent)]" />
            <p className="font-bold">{p.name}</p>
            <p className="text-2xl font-extrabold">
              ৳{p.price}
              <span className="text-xs font-normal text-muted"> {p.period}</span>
            </p>
            <p className="flex-1 text-sm text-muted">{p.desc}</p>
            <Button
              variant="accent"
              onClick={() =>
                toast({
                  tone: "info",
                  title: "Subscription billing",
                  body: "Paid through the same verified payment flow in Phase 6.",
                })
              }
            >
              Choose
            </Button>
          </Card>
        ))}
      </div>
      <Card className="flex items-center gap-3 p-4 text-sm">
        <Clock size={18} className="text-muted" /> Current plan: <b>Free</b> · renewals and expiry
        reminders appear here.
      </Card>
    </div>
  );
}

export function CalendarPlanner() {
  const demo = useDemoToast();
  const days = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
  const [hours, setHours] = useState<Record<string, [string, string] | null>>({
    Sat: ["10:00", "22:00"],
    Sun: ["16:00", "22:00"],
    Mon: ["16:00", "22:00"],
    Tue: ["16:00", "22:00"],
    Wed: ["16:00", "22:00"],
    Thu: ["10:00", "18:00"],
    Fri: null,
  });
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader
          title="Weekly availability"
          sub="Asia/Dhaka. Offers and consultation bookings respect these hours."
        />
        <ul className="divide-y divide-line">
          {days.map((d) => {
            const h = hours[d];
            return (
              <li key={d} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <label className="flex w-24 items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={!!h}
                    onChange={(e) =>
                      setHours({ ...hours, [d]: e.target.checked ? ["16:00", "22:00"] : null })
                    }
                    className="accent-[var(--color-accent)]"
                  />
                  {d}
                </label>
                {h ? (
                  <span className="flex items-center gap-2 text-sm">
                    <input
                      type="time"
                      aria-label={`${d} from`}
                      className="input h-9 w-28"
                      value={h[0]}
                      onChange={(e) => setHours({ ...hours, [d]: [e.target.value, h[1]] })}
                    />
                    –
                    <input
                      type="time"
                      aria-label={`${d} to`}
                      className="input h-9 w-28"
                      value={h[1]}
                      onChange={(e) => setHours({ ...hours, [d]: [h[0], e.target.value] })}
                    />
                  </span>
                ) : (
                  <span className="text-sm text-muted">Unavailable</span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between border-t border-line p-4">
          <label className="flex items-center gap-2 text-sm">
            Max active orders{" "}
            <input type="number" min={1} max={20} defaultValue={5} className="input h-9 w-20" />
          </label>
          <Button variant="accent" onClick={() => demo("Availability saved")}>
            Save
          </Button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Upcoming sessions" sub="1:1 consultations (audio/video, not recorded)" />
        <ul className="divide-y divide-line">
          {[
            ["Sadia Islam", "EK-24521 · heart diagram labels", 26],
            ["Mahfuz Rahman", "EK-24518 · khata format check", 50],
          ].map(([n, s, h]) => (
            <li key={n as string} className="flex items-center gap-3 p-4">
              <Avatar name={n as string} hue={(h as number) * 7} size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{n as string}</p>
                <p className="truncate text-xs text-muted">{s as string}</p>
                <p className="text-xs text-[var(--color-accent)]">
                  {formatDate(fixtures.at(h as number), "en", true)}
                </p>
              </div>
              <Link
                href="/mentor/messages"
                className="text-xs font-semibold text-[var(--color-accent)]"
              >
                Chat
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function DeclinedNotice() {
  return (
    <p className="flex items-center gap-2 text-xs text-muted">
      <XCircle size={14} /> Declined or expired offers move to the next matching mentor
      automatically.
    </p>
  );
}
