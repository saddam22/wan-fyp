"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Eye,
  EyeOff,
  Megaphone,
  Pencil,
  Plus,
  Scale,
  Send,
  Trash2,
} from "lucide-react";
import {
  fixtures,
  formatDate,
  formatMoney,
  type Coupon,
  type Dispute,
  type Review,
} from "@edukhata/contracts";
import { Badge, Button, Card, CardHeader, Field, KeyValue, Stars } from "@/components/ui";
import { DataTable, Modal, Tabs, useDemoToast, useToast } from "@/components/ui/client";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { LEVEL } from "@/lib/labels";

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition",
        on ? "bg-success" : "bg-slate-300",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
          on ? "left-4.5" : "left-0.5",
        )}
      />
    </button>
  );
}

/** Small "add item" modal used by several managers. */
function AddModal({
  open,
  onClose,
  title,
  fields,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: [string, string][];
  onSave: (v: Record<string, string>) => void;
}) {
  const [v, setV] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            onClick={() =>
              fields.some(([k]) => !v[k]?.trim())
                ? setErr("Fill in all fields")
                : (onSave(v), setV({}), setErr(""), onClose())
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {fields.map(([k, label]) => (
          <Field key={k} label={label} htmlFor={`am-${k}`} required>
            {k === "body" ? (
              <textarea
                id={`am-${k}`}
                rows={5}
                className="input"
                value={v[k] ?? ""}
                onChange={(e) => setV({ ...v, [k]: e.target.value })}
              />
            ) : (
              <input
                id={`am-${k}`}
                className="input"
                value={v[k] ?? ""}
                onChange={(e) => setV({ ...v, [k]: e.target.value })}
              />
            )}
          </Field>
        ))}
        {err && <p className="text-xs text-danger">{err}</p>}
      </div>
    </Modal>
  );
}

export function CatalogManager() {
  const { lang } = useT();
  const demo = useDemoToast();
  const [tab, setTab] = useState<"subjects" | "categories" | "classes" | "boards">("subjects");
  const [add, setAdd] = useState(false);
  const [extra, setExtra] = useState<Record<string, string[]>>({
    subjects: [],
    categories: [],
    classes: [],
    boards: [],
  });
  const lists: Record<typeof tab, { name: string; meta: string }[]> = {
    subjects: fixtures.subjects.map((s) => ({
      name: lang === "bn" ? s.nameBn : s.name,
      meta: s.levels.map((l) => LEVEL[l]).join(", "),
    })),
    categories: fixtures.categories.map((c) => ({
      name: c.name,
      meta: `${c.kind} · ${c.taskCount} tasks`,
    })),
    classes: [
      "Class 6–8",
      "Class 9",
      "Class 10",
      "HSC 1st year",
      "HSC 2nd year",
      "Diploma",
      "Undergraduate",
      "Postgraduate",
    ].map((n) => ({ name: n, meta: "Level" })),
    boards: [
      "Dhaka",
      "Rajshahi",
      "Chattogram",
      "Cumilla",
      "Jashore",
      "Barishal",
      "Sylhet",
      "Dinajpur",
      "Mymensingh",
      "Madrasah",
      "Technical",
      "English medium (Cambridge/Edexcel)",
    ].map((n) => ({ name: n, meta: "Education board / curriculum" })),
  };
  const rows = [...lists[tab], ...extra[tab]!.map((n) => ({ name: n, meta: "New (demo)" }))];
  return (
    <Card>
      <div className="flex items-center justify-between pr-3">
        <Tabs
          className="flex-1 px-3"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "subjects", label: "Subjects" },
            { id: "categories", label: "Categories" },
            { id: "classes", label: "Classes" },
            { id: "boards", label: "Boards" },
          ]}
        />
        <Button size="sm" variant="accent" onClick={() => setAdd(true)}>
          <Plus size={14} /> Add
        </Button>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="flex-1">
              <span className="block font-semibold">{r.name}</span>
              <span className="text-xs text-muted">{r.meta}</span>
            </span>
            <button
              aria-label={`Edit ${r.name}`}
              onClick={() => demo(`${r.name} edited`)}
              className="text-muted hover:text-ink"
            >
              <Pencil size={15} />
            </button>
          </li>
        ))}
      </ul>
      <AddModal
        open={add}
        onClose={() => setAdd(false)}
        title={`Add to ${tab}`}
        fields={[
          ["name", "Name (English)"],
          ["nameBn", "Name (বাংলা)"],
        ]}
        onSave={(v) => (
          setExtra({ ...extra, [tab]: [...extra[tab]!, v.name!] }),
          demo(`${v.name} added`)
        )}
      />
    </Card>
  );
}

export function ModerationQueue() {
  const demo = useDemoToast();
  const items = [
    [
      "Review",
      "Contains a phone number to move payment off-platform",
      "EK-24511 · Tanvir Hossain",
      "red",
    ],
    ["Portfolio image", "Possible copyrighted textbook scan", "Imran Kabir", "amber"],
    [
      "Copyright complaint",
      "Publisher claims a delivered report copies their guide",
      "EK-24356",
      "red",
    ],
    ["Mentor profile", "Bio mentions guaranteed exam marks", "Shamima Akter", "amber"],
    ["Chat report", "Abusive language reported by mentor", "EK-24390", "red"],
  ] as const;
  return (
    <Card>
      <ul className="divide-y divide-line">
        {items.map(([kind, why, ref, tone]) => (
          <li key={why} className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <Badge tone={tone}>{kind}</Badge>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{why}</p>
              <p className="text-xs text-muted">{ref}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => demo(`${kind} kept`)}>
              Keep
            </Button>
            <Button size="sm" variant="danger" onClick={() => demo(`${kind} removed`)}>
              Remove
            </Button>
            <Button size="sm" variant="ghost" onClick={() => demo("Warning sent to user")}>
              Warn user
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function DisputesManager({ disputes }: { disputes: Dispute[] }) {
  const { lang } = useT();
  const toast = useToast();
  const [rows, setRows] = useState(disputes);
  const [sel, setSel] = useState<Dispute | null>(null);
  const [decision, setDecision] = useState<
    "resolved_release" | "resolved_partial" | "resolved_refund"
  >("resolved_partial");
  const [pct, setPct] = useState(50);
  const [reason, setReason] = useState("");
  return (
    <Card>
      <DataTable
        rows={rows}
        rowKey={(d) => d.id}
        onRowClick={setSel}
        searchText={(d) => `${d.orderCode} ${d.openedBy} ${d.reason}`}
        columns={[
          {
            key: "o",
            header: "Order",
            cell: (d) => <span className="font-semibold">{d.orderCode}</span>,
          },
          { key: "b", header: "Opened by", cell: (d) => d.openedBy },
          { key: "r", header: "Reason", cell: (d) => d.reason },
          { key: "a", header: "Amount", cell: (d) => formatMoney(d.amount, lang) },
          {
            key: "s",
            header: "Status",
            cell: (d) => (
              <Badge tone={d.status === "under_review" || d.status === "open" ? "amber" : "green"}>
                {d.status.replace(/_/g, " ")}
              </Badge>
            ),
          },
          {
            key: "t",
            header: "Opened",
            cell: (d) => formatDate(d.openedAt, lang),
            sort: (d) => d.openedAt,
          },
        ]}
      />
      <Modal
        open={!!sel}
        onClose={() => setSel(null)}
        title={`Dispute — ${sel?.orderCode}`}
        size="lg"
        footer={
          sel && !sel.status.startsWith("resolved") ? (
            <>
              <Button variant="outline" onClick={() => setSel(null)}>
                Close
              </Button>
              <Button
                variant="accent"
                onClick={() => {
                  if (reason.trim().length < 10)
                    return toast({
                      tone: "warning",
                      title: "Write the decision reason (shown to both parties)",
                    });
                  setRows((rs) =>
                    rs.map((r) => (r.id === sel.id ? { ...r, status: decision } : r)),
                  );
                  setSel(null);
                  toast({
                    tone: "success",
                    title: "Decision recorded",
                    body: "Refund (if any) goes to the accountant queue. Demo only — not saved.",
                  });
                }}
              >
                <Scale size={15} /> Record decision
              </Button>
            </>
          ) : undefined
        }
      >
        {sel && (
          <div className="space-y-4">
            <KeyValue
              items={[
                ["Opened by", sel.openedBy],
                ["Reason", sel.reason],
                ["Order amount", formatMoney(sel.amount, lang)],
                ["Opened", formatDate(sel.openedAt, lang, true)],
              ]}
            />
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-muted">
              Evidence: order timeline, both revisions, delivered files and the order chat (opens
              from the order page).
            </p>
            {!sel.status.startsWith("resolved") && (
              <>
                <fieldset className="grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      ["resolved_release", "Release to mentor"],
                      ["resolved_partial", "Partial refund"],
                      ["resolved_refund", "Full refund"],
                    ] as const
                  ).map(([v, l]) => (
                    <label
                      key={v}
                      className={cn(
                        "cursor-pointer rounded-lg border p-2.5 text-center text-sm font-semibold",
                        decision === v
                          ? "border-[var(--color-accent)] bg-[var(--color-accent-50)]"
                          : "border-line",
                      )}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        checked={decision === v}
                        onChange={() => setDecision(v)}
                      />
                      {l}
                    </label>
                  ))}
                </fieldset>
                {decision === "resolved_partial" && (
                  <Field
                    label={`Refund ${pct}% (${formatMoney({ ...sel.amount, amountMinor: Math.round((sel.amount.amountMinor * pct) / 100) }, lang)})`}
                    htmlFor="pct"
                  >
                    <input
                      id="pct"
                      type="range"
                      min={10}
                      max={90}
                      step={10}
                      value={pct}
                      onChange={(e) => setPct(Number(e.target.value))}
                      className="w-full accent-[var(--color-accent)]"
                    />
                  </Field>
                )}
                <Field label="Decision reason" required htmlFor="dr">
                  <textarea
                    id="dr"
                    rows={3}
                    className="input"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
              </>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}

export function CouponsManager({ coupons }: { coupons: Coupon[] }) {
  const { lang } = useT();
  const demo = useDemoToast();
  const [rows, setRows] = useState(coupons);
  const [add, setAdd] = useState(false);
  return (
    <Card>
      <DataTable
        rows={rows}
        rowKey={(c) => c.code}
        searchText={(c) => c.code}
        toolbar={
          <Button variant="accent" onClick={() => setAdd(true)}>
            <Plus size={16} /> New coupon
          </Button>
        }
        columns={[
          {
            key: "c",
            header: "Code",
            cell: (c) => (
              <span>
                <span className="block font-mono font-bold">{c.code}</span>
                <span className="text-[11px] text-muted">{c.description}</span>
              </span>
            ),
          },
          { key: "d", header: "Discount", cell: (c) => `${c.discountPct}%` },
          {
            key: "u",
            header: "Used",
            cell: (c) => `${c.used} / ${c.maxUses}`,
            sort: (c) => c.used,
          },
          {
            key: "e",
            header: "Expires",
            cell: (c) => formatDate(c.expiresAt, lang),
            sort: (c) => c.expiresAt,
          },
          {
            key: "a",
            header: "Active",
            cell: (c) => (
              <Toggle
                on={c.active}
                label={`${c.code} active`}
                onChange={(v) =>
                  setRows((rs) => rs.map((r) => (r.code === c.code ? { ...r, active: v } : r)))
                }
              />
            ),
          },
        ]}
      />
      <AddModal
        open={add}
        onClose={() => setAdd(false)}
        title="New coupon"
        fields={[
          ["code", "Code"],
          ["pct", "Discount %"],
          ["max", "Max uses"],
        ]}
        onSave={(v) => (
          setRows([
            {
              code: v.code!.toUpperCase(),
              description: "New coupon",
              discountPct: Number(v.pct),
              maxUses: Number(v.max),
              used: 0,
              expiresAt: fixtures.at(24 * 30),
              active: true,
            },
            ...rows,
          ]),
          demo("Coupon created")
        )}
      />
    </Card>
  );
}

function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-line px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <div className="sm:w-64">{children}</div>
    </div>
  );
}

export function ReferralConfig() {
  const demo = useDemoToast();
  const [on, setOn] = useState(true);
  return (
    <Card>
      <CardHeader
        title="Referral program"
        sub="Rules ported from ICTSpark: first attribution wins (30-day cookie) and never changes; staff accounts excluded."
      />
      <SettingsRow label="Program enabled">
        <Toggle on={on} onChange={setOn} label="Referral enabled" />
      </SettingsRow>
      <SettingsRow label="Referrer reward" hint="Paid into the reward ledger">
        <input className="input" defaultValue="৳100" />
      </SettingsRow>
      <SettingsRow label="Friend discount">
        <input className="input" defaultValue="10%" />
      </SettingsRow>
      <SettingsRow label="When is it earned?">
        <select className="input" defaultValue="first">
          <option value="first">First completed order only</option>
          <option value="every">Every completed order</option>
        </select>
      </SettingsRow>
      <SettingsRow label="Payout of rewards">
        <select className="input" defaultValue="credit">
          <option value="credit">As order credit</option>
          <option value="mobile">bKash/Nagad (min ৳500)</option>
        </select>
      </SettingsRow>
      <div className="flex justify-end p-4">
        <Button variant="accent" onClick={() => demo("Referral settings saved")}>
          Save
        </Button>
      </div>
    </Card>
  );
}

export function BoostsManager() {
  const demo = useDemoToast();
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Plans"
          sub="Paid promotions are always labelled and never change organic ranking or verification."
        />
        <ul className="divide-y divide-line">
          {[
            ["Profile Boost — 7 days", "৳299", 14],
            ["Pro — Monthly", "৳499 / month", 38],
            ["Pro — Yearly", "৳4,990 / year", 9],
          ].map(([n, p, active]) => (
            <li key={n as string} className="flex items-center gap-3 px-5 py-3 text-sm">
              <span className="flex-1 font-semibold">{n}</span>
              <span>{p}</span>
              <Badge tone="violet">{active} active</Badge>
              <button
                aria-label={`Edit ${n}`}
                onClick={() => demo(`${n} edited`)}
                className="text-muted hover:text-ink"
              >
                <Pencil size={15} />
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Active subscriptions" />
        <ul className="divide-y divide-line text-sm">
          {[
            ["Farhana Rahman", "Featured boost", 72],
            ["Shamima Akter", "Pro — Monthly", 300],
            ["Tariq Ahmed", "Pro — Yearly", 4200],
          ].map(([n, p, h]) => (
            <li key={n as string} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="flex-1 font-semibold">{n}</span>
              <span className="text-muted">{p}</span>
              <span className="text-xs">renews {formatDate(fixtures.at(h as number))}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function BannersManager() {
  const demo = useDemoToast();
  const [rows, setRows] = useState([
    { id: "b1", title: "Your Complete Assignment & Practical Solution Platform", active: true },
    { id: "b2", title: "Handwritten Practical Khata delivered to your door", active: true },
    { id: "b3", title: "Biology drawings, diagrams & sketches", active: true },
    { id: "b4", title: "Eid offer — 15% off (expired)", active: false },
  ]);
  const move = (i: number, d: -1 | 1) =>
    setRows((rs) => {
      const c = [...rs];
      [c[i], c[i + d]] = [c[i + d]!, c[i]!];
      return c;
    });
  return (
    <Card>
      <CardHeader
        title="Homepage hero slides"
        sub="Image or video, title, CTA. Order = display order."
        action={
          <Button size="sm" variant="accent" onClick={() => demo("Slide created")}>
            <Plus size={14} /> New slide
          </Button>
        }
      />
      <ul className="divide-y divide-line">
        {rows.map((b, i) => (
          <li key={b.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span
              className="h-10 w-16 shrink-0 rounded-md bg-gradient-to-br from-navy to-brand"
              aria-hidden
            />
            <span className={cn("flex-1 font-semibold", !b.active && "text-muted line-through")}>
              {b.title}
            </span>
            <button
              aria-label="Move up"
              disabled={i === 0}
              onClick={() => move(i, -1)}
              className="text-muted disabled:opacity-30"
            >
              <ArrowUp size={16} />
            </button>
            <button
              aria-label="Move down"
              disabled={i === rows.length - 1}
              onClick={() => move(i, 1)}
              className="text-muted disabled:opacity-30"
            >
              <ArrowDown size={16} />
            </button>
            <Toggle
              on={b.active}
              label={`${b.title} active`}
              onChange={(v) =>
                setRows((rs) => rs.map((r) => (r.id === b.id ? { ...r, active: v } : r)))
              }
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PagesCMS() {
  const demo = useDemoToast();
  const [edit, setEdit] = useState<string | null>(null);
  const pages = [
    ["About", "/about", "Published"],
    ["Privacy Policy", "/privacy", "Draft — legal review"],
    ["Terms & Conditions", "/terms", "Draft — legal review"],
    ["Refund Policy", "/refund-policy", "Draft — legal review"],
    ["FAQ", "/faq", "Published"],
    ["How It Works", "/how-it-works", "Published"],
    ["Pricing", "/pricing", "Published"],
  ];
  return (
    <Card>
      <ul className="divide-y divide-line">
        {pages.map(([t, p, s]) => (
          <li key={p} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <span className="flex-1">
              <span className="block font-semibold">{t}</span>
              <span className="font-mono text-xs text-muted">{p}</span>
            </span>
            <Badge tone={s!.startsWith("Draft") ? "amber" : "green"}>{s}</Badge>
            <a
              href={p}
              target="_blank"
              rel="noreferrer"
              className="text-muted hover:text-ink"
              aria-label={`Open ${t}`}
            >
              <ExternalLink size={15} />
            </a>
            <Button size="sm" variant="outline" onClick={() => setEdit(t!)}>
              <Pencil size={14} /> Edit
            </Button>
          </li>
        ))}
      </ul>
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={`Edit — ${edit}`}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button variant="accent" onClick={() => (setEdit(null), demo("Page saved as draft"))}>
              Save draft
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Title (English)" htmlFor="pg-t">
            <input id="pg-t" className="input" defaultValue={edit ?? ""} />
          </Field>
          <Field label="Title (বাংলা)" htmlFor="pg-tb">
            <input id="pg-tb" className="input" />
          </Field>
          <Field
            label="Content (Markdown)"
            htmlFor="pg-c"
            hint="Sanitised on save; scripts and inline handlers are stripped."
          >
            <textarea id="pg-c" rows={10} className="input font-mono text-xs" />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}

export function BlogManager() {
  const { lang } = useT();
  const demo = useDemoToast();
  const [add, setAdd] = useState(false);
  return (
    <Card>
      <DataTable
        rows={fixtures.blogPosts}
        rowKey={(p) => p.slug}
        searchText={(p) => p.title}
        toolbar={
          <Button variant="accent" onClick={() => setAdd(true)}>
            <Plus size={16} /> New post
          </Button>
        }
        columns={[
          {
            key: "t",
            header: "Title",
            cell: (p) => (
              <span>
                <span className="block font-semibold">{p.title}</span>
                <span className="text-[11px] text-muted">/{p.slug}</span>
              </span>
            ),
          },
          { key: "a", header: "Author", cell: (p) => p.author },
          { key: "g", header: "Tag", cell: (p) => <Badge tone="blue">{p.tag}</Badge> },
          { key: "d", header: "Published", cell: (p) => formatDate(p.at, lang), sort: (p) => p.at },
          {
            key: "x",
            header: "",
            cell: (p) => (
              <span className="flex gap-2">
                <button
                  aria-label={`Edit ${p.title}`}
                  onClick={() => demo("Post opened in editor")}
                  className="text-muted hover:text-ink"
                >
                  <Pencil size={15} />
                </button>
                <button
                  aria-label={`Delete ${p.title}`}
                  onClick={() => demo("Post deleted")}
                  className="text-muted hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </span>
            ),
          },
        ]}
      />
      <AddModal
        open={add}
        onClose={() => setAdd(false)}
        title="New blog post"
        fields={[
          ["title", "Title"],
          ["tag", "Tag"],
          ["body", "Body"],
        ]}
        onSave={() => demo("Post saved as draft")}
      />
    </Card>
  );
}

export function ReviewsModeration({ reviews }: { reviews: Review[] }) {
  const { lang } = useT();
  const demo = useDemoToast();
  const [rows, setRows] = useState(reviews);
  const set = (id: string, status: Review["status"]) => (
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r))),
    demo(`Review ${status}`)
  );
  return (
    <Card>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        searchText={(r) => `${r.studentName} ${r.text} ${r.orderCode}`}
        filters={{
          label: "Status",
          options: [
            { value: "pending", label: "Pending" },
            { value: "published", label: "Published" },
            { value: "hidden", label: "Hidden" },
          ],
          test: (r, v) => r.status === v,
        }}
        columns={[
          {
            key: "r",
            header: "Review",
            cell: (r) => (
              <span className="block max-w-md">
                <Stars rating={r.rating} showValue={false} size={11} />
                <span className="mt-0.5 block text-sm">{r.text}</span>
                <span className="text-[11px] text-muted">
                  {r.studentName} · {r.orderCode} · {formatDate(r.at, lang)}
                </span>
              </span>
            ),
          },
          {
            key: "m",
            header: "Mentor",
            cell: (r) => fixtures.mentors.find((m) => m.id === r.mentorId)?.name,
          },
          {
            key: "s",
            header: "Status",
            cell: (r) => (
              <Badge
                tone={
                  r.status === "published" ? "green" : r.status === "pending" ? "amber" : "gray"
                }
              >
                {r.status}
              </Badge>
            ),
          },
          {
            key: "x",
            header: "",
            cell: (r) => (
              <span className="flex gap-1.5">
                {r.status !== "published" && (
                  <Button size="sm" variant="success" onClick={() => set(r.id, "published")}>
                    <Eye size={13} /> Publish
                  </Button>
                )}
                {r.status !== "hidden" && (
                  <Button size="sm" variant="outline" onClick={() => set(r.id, "hidden")}>
                    <EyeOff size={13} /> Hide
                  </Button>
                )}
              </span>
            ),
          },
        ]}
      />
    </Card>
  );
}

export function AdsConfig() {
  const demo = useDemoToast();
  const [rows, setRows] = useState([
    { slug: "home-native", where: "Homepage, between sections", format: "native", on: true },
    { slug: "blog-list", where: "Blog list", format: "native", on: true },
    { slug: "blog-end", where: "End of blog articles", format: "text / native", on: true },
    { slug: "mentor-list", where: "Mentor search, every 8 cards", format: "native", on: false },
  ]);
  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-3 p-5 text-sm">
        <Megaphone className="text-[var(--color-accent)]" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">WAN Central Ad Platform</p>
          <p className="text-muted">
            Campaigns, advertisers, budgets and reports live in the Ad Platform. EduKhata only
            decides where labelled ad slots appear.
          </p>
        </div>
        <Badge tone="amber">App key not configured</Badge>
      </Card>
      <Card>
        <CardHeader
          title="Placements"
          sub="“Students use this app” is on: finance, health, gambling, dating, tobacco and alcohol ads are blocked."
        />
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.slug} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="flex-1">
                <span className="block font-mono font-semibold">{r.slug}</span>
                <span className="text-xs text-muted">
                  {r.where} · {r.format}
                </span>
              </span>
              <Toggle
                on={r.on}
                label={`${r.slug} enabled`}
                onChange={(v) =>
                  setRows((rs) => rs.map((x) => (x.slug === r.slug ? { ...x, on: v } : x)))
                }
              />
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-4 py-3 text-xs text-muted">
          Never shown on: order creation, payment, work preview, revisions, disputes, skill tests or
          financial pages.
        </p>
        <div className="flex justify-end p-4 pt-0">
          <Button variant="accent" onClick={() => demo("Placement settings saved")}>
            Save
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function WebsiteMessages() {
  const demo = useDemoToast();
  const msgs = [
    ["Rahim Uddin", "01811-XXXXXX", "Do you deliver practical khata to Rajshahi?", 3, false],
    [
      "Nasrin Begum",
      "nasrin@example.com",
      "My son is in class 9 — which board formats do you support?",
      20,
      false,
    ],
    [
      "Dhaka College (staff)",
      "office@example.edu",
      "Academic-integrity question about your service.",
      50,
      true,
    ],
  ] as const;
  return (
    <Card>
      <ul className="divide-y divide-line">
        {msgs.map(([n, c, m, h, flagged]) => (
          <li key={n} className="flex flex-wrap items-start gap-3 p-4 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {n} <span className="font-normal text-muted">· {c}</span>{" "}
                {flagged && <Badge tone="red">Institution</Badge>}
              </p>
              <p className="text-slate-700">{m}</p>
              <p className="text-[11px] text-muted">{formatDate(fixtures.at(-h), "en", true)}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => demo("Reply sent")}>
              <Send size={13} /> Reply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => demo("Converted to ticket")}>
              To ticket
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function NotificationBroadcast() {
  const demo = useDemoToast();
  const [f, setF] = useState({ audience: "students", title: "", body: "" });
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader
          title="Send an announcement"
          sub="Delivered as in-app + push (WAN social module). Users' preferences are respected."
        />
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => (
            e.preventDefault(),
            f.title && f.body ? demo(`Announcement queued to ${f.audience}`) : undefined
          )}
        >
          <Field label="Audience" htmlFor="nb-a">
            <select
              id="nb-a"
              className="input"
              value={f.audience}
              onChange={(e) => setF({ ...f, audience: e.target.value })}
            >
              <option value="students">All students</option>
              <option value="mentors">All mentors</option>
              <option value="guardians">All guardians</option>
              <option value="everyone">Everyone</option>
            </select>
          </Field>
          <Field label="Title" required htmlFor="nb-t">
            <input
              id="nb-t"
              className="input"
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
            />
          </Field>
          <Field label="Message" required htmlFor="nb-b">
            <textarea
              id="nb-b"
              rows={4}
              className="input"
              value={f.body}
              onChange={(e) => setF({ ...f, body: e.target.value })}
            />
          </Field>
          <Button type="submit" variant="accent" disabled={!f.title || !f.body}>
            <Send size={15} /> Send
          </Button>
        </form>
      </Card>
      <Card>
        <CardHeader title="System notification types" />
        <ul className="divide-y divide-line text-sm">
          {[
            "order.offer",
            "order.assigned",
            "order.delivered",
            "order.revision",
            "payment.approved",
            "payment.rejected",
            "deadline.soon",
            "payout.paid",
            "dispute.update",
          ].map((t) => (
            <li key={t} className="flex items-center justify-between px-4 py-2.5">
              <span className="font-mono text-xs">{t}</span>
              <Badge tone={t.startsWith("payment") || t.startsWith("deadline") ? "red" : "gray"}>
                {t.startsWith("payment") || t.startsWith("deadline") ? "mandatory" : "optional"}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function RewardsManager() {
  const demo = useDemoToast();
  return (
    <Card>
      <CardHeader
        title="Points & badges"
        sub="Students earn points for completed orders and reviews; mentors earn earned badges (never paid)."
      />
      <ul className="divide-y divide-line text-sm">
        {[
          ["Completed order (student)", "+50 points"],
          ["Review written", "+20 points"],
          ["Referral rewarded", "+100 points"],
          ["Top Rated (mentor)", "4.8+ over 100 reviews"],
          ["On-Time Pro (mentor)", "98% on time over 50 orders"],
          ["Subject Expert (mentor)", "Skill test 90+"],
        ].map(([r, v]) => (
          <li key={r} className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="font-semibold">{r}</span>
            <span className="text-muted">{v}</span>
            <button
              aria-label={`Edit ${r}`}
              onClick={() => demo(`${r} rule edited`)}
              className="text-muted hover:text-ink"
            >
              <Pencil size={15} />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function SettingsForm() {
  const toast = useToast();
  const [rate, setRate] = useState("20");
  const [err, setErr] = useState("");
  return (
    <Card>
      <CardHeader
        title="Marketplace rules"
        sub="Every change is written to the audit log with the old and new value."
      />
      <SettingsRow
        label="Platform commission"
        hint="Copied onto each order at payment time; past orders never change."
      >
        <div className="flex items-center gap-2">
          <input
            className="input"
            type="number"
            min={0}
            max={50}
            value={rate}
            aria-invalid={!!err}
            onChange={(e) => setRate(e.target.value)}
          />
          <span className="text-sm">%</span>
        </div>
        {err && <p className="mt-1 text-xs text-danger">{err}</p>}
      </SettingsRow>
      <SettingsRow label="Mentor share">
        <p className="text-sm font-semibold">{100 - (Number(rate) || 0)}%</p>
      </SettingsRow>
      <SettingsRow label="Free revisions per order" hint="Business default 2–3">
        <select className="input" defaultValue="2">
          <option>2</option>
          <option>3</option>
        </select>
      </SettingsRow>
      <SettingsRow label="Extra revision fee">
        <input className="input" defaultValue="৳100" />
      </SettingsRow>
      <SettingsRow
        label="Auto-approve after delivery"
        hint="If the student neither approves nor asks for a revision"
      >
        <select className="input" defaultValue="72">
          <option value="48">48 hours</option>
          <option value="72">72 hours</option>
          <option value="120">5 days</option>
        </select>
      </SettingsRow>
      <SettingsRow label="Offer time limit" hint="How long a mentor has to accept a matched order">
        <select className="input" defaultValue="15">
          <option value="10">10 minutes</option>
          <option value="15">15 minutes</option>
          <option value="30">30 minutes</option>
        </select>
      </SettingsRow>
      <SettingsRow label="Second approver for payments ≥">
        <input className="input" defaultValue="৳3,000" />
      </SettingsRow>
      <SettingsRow label="Minimum payout">
        <input className="input" defaultValue="৳500" />
      </SettingsRow>
      <SettingsRow label="Mentor earnings holding period" hint="Open decision Q8">
        <select className="input" defaultValue="0">
          <option value="0">Available on approval</option>
          <option value="7">7 days after closure</option>
        </select>
      </SettingsRow>
      <SettingsRow
        label="Payment accounts"
        hint="bKash/Nagad/Rocket numbers and bank account shown at checkout"
      >
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            toast({
              tone: "info",
              title: "Payment accounts",
              body: "Edited here in Phase 5; values never appear in client code.",
            })
          }
        >
          Manage accounts
        </Button>
      </SettingsRow>
      <SettingsRow label="Launch country">
        <select className="input" defaultValue="BD">
          <option value="BD">Bangladesh (BDT)</option>
          <option disabled>More countries — after approval</option>
        </select>
      </SettingsRow>
      <div className="flex justify-end p-4">
        <Button
          variant="accent"
          onClick={() => {
            const n = Number(rate);
            if (!Number.isFinite(n) || n < 0 || n > 50)
              return setErr("Commission must be between 0 and 50%");
            setErr("");
            toast({ tone: "success", title: "Settings saved", body: "Demo only — not saved." });
          }}
        >
          Save settings
        </Button>
      </div>
    </Card>
  );
}

export function SecurityPanel() {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader title="Security events (24 h)" />
        <ul className="divide-y divide-line text-sm">
          {[
            ["Rate limit hit", "POST /payments/:id/manual · 103.••.••.90", "amber"],
            ["Duplicate TrxID rejected", "INV-2026-01848 reused 7HG2K9QX1", "red"],
            ["Forbidden route", "Accountant tried /admin/settings", "amber"],
            ["New staff login", "Rumana Haque · new device", "blue"],
          ].map(([a, b, t]) => (
            <li key={a} className="flex items-center gap-3 px-4 py-3">
              <Badge tone={t as "red"}>{a}</Badge>
              <span className="text-muted">{b}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader
          title="Controls checklist"
          sub="Status of Module 17 controls (implemented from Phase 2 onward)"
        />
        <ul className="divide-y divide-line text-sm">
          {[
            ["Server-side authorization on every route", "Planned"],
            ["Staff two-factor (via WAN ID)", "Planned"],
            ["Private storage + signed URLs", "Planned"],
            ["TrxID unique constraint", "Planned"],
            ["Payout idempotency", "Planned"],
            ["Audit log hash chain", "Planned"],
            ["CSP & security headers", "Planned"],
            ["Backups & restore drill", "Planned"],
          ].map(([c, s]) => (
            <li key={c} className="flex items-center justify-between px-4 py-2.5">
              <span>{c}</span>
              <Badge tone="amber">{s}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
