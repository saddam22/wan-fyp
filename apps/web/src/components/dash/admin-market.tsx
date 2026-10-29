"use client";

import Link from "next/link";
import { useState } from "react";
import { Star } from "lucide-react";
import { formatDate, formatMoney, type Money } from "@edukhata/contracts";
import { Badge, Button, Card, EmptyState, Field } from "@/components/ui";
import { Modal, useToast } from "@/components/ui/client";
import { useT } from "@/lib/i18n/client";
import { orderApi } from "@/lib/order-api";

/** GET /api/admin/disputes */
export interface LiveDispute {
  id: string;
  orderId: string;
  orderCode: string;
  title: string;
  openedBy: string;
  reason: string;
  amount: Money;
  status: string;
  refundMinor: number | null;
  resolutionNote: string | null;
  openedAt: string;
}

/** Dispute decisions: release (work stands), full refund, or partial refund. */
export function LiveDisputes({ disputes: initial }: { disputes: LiveDispute[] }) {
  const { lang } = useT();
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState<LiveDispute | null>(null);
  const [outcome, setOutcome] = useState<"release" | "refund" | "partial">("release");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const resolve = async () => {
    const d = open!;
    const refundMinor = Math.round(Number(amount) * 100);
    if (note.trim().length < 5) return setErr("Explain the decision");
    setBusy(true);
    try {
      await orderApi(`/admin/disputes/${d.id}/resolve`, "POST", {
        outcome,
        note,
        ...(outcome === "partial" ? { refundMinor } : {}),
      });
      setRows((xs) => xs.map((x) => (x.id === d.id ? { ...x, status: `resolved_${outcome}` } : x)));
      setOpen(null);
      toast({
        tone: "success",
        title: `${d.orderCode}: decision recorded`,
        body: "Both sides are notified.",
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (rows.length === 0)
    return (
      <Card>
        <EmptyState title="No disputes" />
      </Card>
    );
  return (
    <Card>
      <ul className="divide-y divide-line" data-testid="disputes">
        {rows.map((d) => (
          <li key={d.id} className="flex flex-wrap items-start gap-3 p-4 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                <Link href={`/admin/orders/${d.orderId}`} className="hover:underline">
                  {d.orderCode}
                </Link>{" "}
                · {d.title}
              </p>
              <p className="mt-1 text-slate-700">“{d.reason}”</p>
              <p className="mt-1 text-[11px] text-muted">
                {d.openedBy} · {formatDate(d.openedAt, lang, true)} · {formatMoney(d.amount, lang)}
              </p>
            </div>
            {d.status === "open" ? (
              <Button
                size="sm"
                variant="accent"
                onClick={() => (setOpen(d), setErr(""), setNote(""), setAmount(""))}
              >
                Decide
              </Button>
            ) : (
              <Badge tone="green">{d.status.replace("resolved_", "Resolved: ")}</Badge>
            )}
          </li>
        ))}
      </ul>
      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={`Decide ${open?.orderCode}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button variant="accent" disabled={busy} onClick={resolve}>
              Record decision
            </Button>
          </>
        }
      >
        <fieldset className="mb-3 space-y-2 text-sm">
          {(
            [
              ["release", "Release — the work stands, the mentor is paid"],
              ["partial", "Partial refund — part of the price back, order closed"],
              ["refund", "Full refund — the order is refunded"],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className="flex items-center gap-2">
              <input
                type="radio"
                name="outcome"
                checked={outcome === v}
                onChange={() => setOutcome(v)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        {outcome === "partial" && (
          <Field label="Refund amount (BDT)" htmlFor="ramt">
            <input
              id="ramt"
              type="number"
              min={1}
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
        )}
        <Field label="Decision note (both sides see it)" required htmlFor="rnote" error={err}>
          <textarea
            id="rnote"
            rows={3}
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <p className="mt-2 text-[11px] text-muted">
          Refund money is paid out by the accounts team.
        </p>
      </Modal>
    </Card>
  );
}

/** GET /api/admin/reviews */
export interface LiveReview {
  id: string;
  rating: number;
  text: string;
  status: string;
  at: string;
  studentName: string;
  mentorName: string;
  orderCode: string;
}

export function LiveReviews({ reviews: initial }: { reviews: LiveReview[] }) {
  const { lang } = useT();
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const moderate = async (r: LiveReview, status: "published" | "hidden") => {
    try {
      await orderApi(`/admin/reviews/${r.id}/moderate`, "POST", { status });
      setRows((xs) => xs.map((x) => (x.id === r.id ? { ...x, status } : x)));
      toast({ tone: "success", title: status === "published" ? "Published" : "Hidden" });
    } catch (e) {
      toast({ tone: "danger", title: "Not saved", body: (e as Error).message });
    }
  };
  if (rows.length === 0)
    return (
      <Card>
        <EmptyState title="No reviews yet" />
      </Card>
    );
  return (
    <Card>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start gap-3 p-4 text-sm">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 font-semibold">
                {Array.from({ length: r.rating }, (_, i) => (
                  <Star key={i} size={13} className="fill-amber-400 text-amber-400" />
                ))}
                <span className="ml-2">
                  {r.studentName} → {r.mentorName}
                </span>
              </p>
              {r.text && <p className="mt-1 text-slate-700">{r.text}</p>}
              <p className="mt-1 text-[11px] text-muted">
                {r.orderCode} · {formatDate(r.at, lang, true)}
              </p>
            </div>
            <Badge
              tone={r.status === "published" ? "green" : r.status === "pending" ? "amber" : "gray"}
            >
              {r.status}
            </Badge>
            {r.status !== "published" && (
              <Button size="sm" variant="success" onClick={() => moderate(r, "published")}>
                Publish
              </Button>
            )}
            {r.status !== "hidden" && (
              <Button size="sm" variant="outline" onClick={() => moderate(r, "hidden")}>
                Hide
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** GET/PUT /api/admin/settings — business rules (super admin). */
export type LiveSettings = Record<string, number>;

const RULES: { key: string; label: string; hint: string; pct?: boolean; step?: number }[] = [
  {
    key: "commission_rate",
    label: "Platform commission",
    hint: "Mentor gets the rest (20% → 80/20)",
    pct: true,
  },
  { key: "free_revisions", label: "Free revisions per order", hint: "Requirement: 2–3" },
  {
    key: "paid_revision_fee_pct",
    label: "Paid revision fee",
    hint: "Share of the order price (owner decision)",
    pct: true,
  },
  { key: "max_revisions", label: "Revision limit per order", hint: "After that: dispute" },
  { key: "courier_fee_minor", label: "Courier fee (paisa)", hint: "12000 = ৳120" },
  { key: "min_deadline_hours", label: "Shortest deadline (hours)", hint: "" },
  { key: "offer_ttl_minutes", label: "Offer time to accept (minutes)", hint: "" },
  { key: "offer_wave_size", label: "Mentors per offer wave", hint: "" },
  { key: "max_offer_waves", label: "Waves before admin assigns", hint: "" },
  {
    key: "preferred_mentor_minutes",
    label: "Chosen mentor's exclusive window (minutes)",
    hint: "",
  },
  { key: "auto_close_days", label: "Auto-close approved orders after (days)", hint: "" },
  { key: "deadline_reminder_hours", label: "Deadline reminder (hours before)", hint: "" },
];

export function LiveSettingsForm({ settings }: { settings: LiveSettings }) {
  const toast = useToast();
  const [v, setV] = useState(settings);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const patch = Object.fromEntries(Object.entries(v).filter(([k, x]) => settings[k] !== x));
    if (Object.keys(patch).length === 0) return toast({ tone: "info", title: "Nothing changed" });
    setBusy(true);
    try {
      setV(await orderApi<LiveSettings>("/admin/settings", "PUT", patch));
      toast({
        tone: "success",
        title: "Rules saved",
        body: "New orders use them; existing orders keep theirs. Logged in the audit trail.",
      });
    } catch (e) {
      toast({ tone: "danger", title: "Not saved", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <form
        className="grid gap-4 p-5 sm:grid-cols-2"
        onSubmit={(e) => (e.preventDefault(), void save())}
      >
        {RULES.map((r) => (
          <Field key={r.key} label={r.label} htmlFor={`set-${r.key}`} hint={r.hint || undefined}>
            <input
              id={`set-${r.key}`}
              type="number"
              step={r.pct ? 1 : 1}
              className="input"
              value={r.pct ? Math.round((v[r.key] ?? 0) * 100) : (v[r.key] ?? 0)}
              onChange={(e) =>
                setV({
                  ...v,
                  [r.key]: r.pct ? Number(e.target.value) / 100 : Number(e.target.value),
                })
              }
            />
          </Field>
        ))}
        <div className="sm:col-span-2">
          <Button type="submit" variant="accent" disabled={busy}>
            Save rules
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Price per page by type of work (admin). */
export function LivePriceList({
  prices,
  labels,
}: {
  prices: Record<string, { amountMinor: number }>;
  labels: Record<string, string>;
}) {
  const toast = useToast();
  const [v, setV] = useState(
    Object.fromEntries(Object.entries(prices).map(([k, p]) => [k, p.amountMinor / 100])),
  );
  const save = async (k: string) => {
    try {
      await orderApi(`/admin/price-list/${k}`, "PUT", {
        perPageMinor: Math.round((v[k] ?? 0) * 100),
      });
      toast({ tone: "success", title: `${labels[k] ?? k}: price saved` });
    } catch (e) {
      toast({ tone: "danger", title: "Not saved", body: (e as Error).message });
    }
  };
  return (
    <Card className="p-5">
      <p className="mb-3 font-bold">Price per page (BDT)</p>
      <ul className="space-y-2">
        {Object.keys(v).map((k) => (
          <li key={k} className="flex items-center gap-3 text-sm">
            <span className="flex-1">{labels[k] ?? k}</span>
            <input
              type="number"
              min={1}
              aria-label={`${labels[k] ?? k} price per page`}
              className="input w-28"
              value={v[k]}
              onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })}
            />
            <Button size="sm" variant="outline" onClick={() => save(k)}>
              Save
            </Button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-muted">
        New orders use the new price; placed orders keep theirs.
      </p>
    </Card>
  );
}
