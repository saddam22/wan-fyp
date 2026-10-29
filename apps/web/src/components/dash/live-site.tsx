"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { formatDate } from "@edukhata/contracts";
import { Badge, Button, Card, CardHeader, Field } from "@/components/ui";
import { DataTable, Modal, useToast } from "@/components/ui/client";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { orderApi } from "@/lib/order-api";

// ---- Website messages -----------------------------------------------------------------

export interface ContactMessage {
  id: string;
  name: string;
  contact: string;
  topic: "order" | "payment" | "mentor" | "copyright" | "institution" | "other";
  message: string;
  status: "open" | "handled" | "spam";
  note: string | null;
  handledBy: string | null;
  handledAt: string | null;
  createdAt: string;
}
const M_STATUS: Record<ContactMessage["status"], [string, "amber" | "green" | "gray"]> = {
  open: ["Open", "amber"],
  handled: ["Handled", "green"],
  spam: ["Spam", "gray"],
};

/** Messages from the contact form. No email provider yet: reply by phone or email, then note it. */
export function MessagesAdmin({ items }: { items: ContactMessage[] }) {
  const { lang } = useT();
  const toast = useToast();
  const [rows, setRows] = useState(items);
  const [sel, setSel] = useState<ContactMessage | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const set = async (status: ContactMessage["status"]) => {
    if (!sel) return;
    setErr("");
    try {
      await orderApi(`/admin/messages/${sel.id}`, "POST", { status, note });
      setRows((rs) =>
        rs.map((r) =>
          r.id === sel.id
            ? { ...r, status, note: note || null, handledAt: new Date().toISOString() }
            : r,
        ),
      );
      toast({
        tone: "success",
        title: status === "handled" ? "Marked as handled" : `Marked ${status}`,
      });
      setSel(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Card>
      <DataTable
        rows={rows}
        rowKey={(m) => m.id}
        onRowClick={(m) => (setSel(m), setNote(m.note ?? ""), setErr(""))}
        searchText={(m) => `${m.name} ${m.contact} ${m.message}`}
        filters={{
          label: "Status",
          options: Object.entries(M_STATUS).map(([value, v]) => ({ value, label: v[0] })),
          test: (m, v) => m.status === v,
        }}
        empty={{ title: "No messages" }}
        columns={[
          {
            key: "n",
            header: "From",
            cell: (m) => (
              <span>
                <b className="block">
                  {m.name} {m.topic === "institution" && <Badge tone="red">Institution</Badge>}
                </b>
                <span className="text-[11px] text-muted">{m.contact}</span>
              </span>
            ),
          },
          {
            key: "m",
            header: "Message",
            cell: (m) => <span className="line-clamp-2">{m.message}</span>,
          },
          {
            key: "d",
            header: "Received",
            cell: (m) => formatDate(m.createdAt, lang, true),
            sort: (m) => m.createdAt,
          },
          {
            key: "s",
            header: "Status",
            cell: (m) => <Badge tone={M_STATUS[m.status][1]}>{M_STATUS[m.status][0]}</Badge>,
          },
        ]}
      />
      <Modal
        open={!!sel}
        onClose={() => setSel(null)}
        title={`Message from ${sel?.name ?? ""}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => set("spam")}>
              Spam
            </Button>
            {sel?.status !== "open" && (
              <Button variant="outline" onClick={() => set("open")}>
                Reopen
              </Button>
            )}
            <Button variant="accent" onClick={() => set("handled")}>
              Mark handled
            </Button>
          </>
        }
      >
        {sel && (
          <div className="space-y-3 text-sm">
            <p className="text-muted">
              {sel.contact} · {sel.topic} · {formatDate(sel.createdAt, lang, true)}
            </p>
            <p className="whitespace-pre-wrap">{sel.message}</p>
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              Reply by email or phone to {sel.contact}, then note what you said. (Email sending is
              not connected yet.)
            </p>
            <Field label="What was answered" htmlFor="msg-n" error={err}>
              <textarea
                id="msg-n"
                rows={3}
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            {sel.handledBy && (
              <p className="text-xs text-muted">
                Handled by {sel.handledBy}
                {sel.handledAt && ` · ${formatDate(sel.handledAt, lang, true)}`}
              </p>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}

// ---- Homepage banners -----------------------------------------------------------------

export interface Banner {
  id: string;
  pre: string;
  main: string;
  post: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  tone: "blue" | "violet" | "teal" | "rose" | "amber";
  active: boolean;
  sort: number;
}
type BannerDraft = Omit<Banner, "id" | "sort"> & { id?: string };
const BLANK: BannerDraft = {
  pre: "",
  main: "",
  post: "",
  ctaLabel: null,
  ctaHref: null,
  tone: "blue",
  active: true,
};
const TONES: Banner["tone"][] = ["blue", "violet", "teal", "rose", "amber"];

/** Homepage hero slides: text, an optional button, colour; order = display order. */
export function BannersAdmin({ items }: { items: Banner[] }) {
  const toast = useToast();
  const [rows, setRows] = useState(items);
  const [d, setD] = useState<BannerDraft | null>(null);
  const [err, setErr] = useState("");
  const save = async (b: BannerDraft) => {
    setErr("");
    try {
      const { id, ...body } = b;
      const r = await orderApi<Banner>(
        id ? `/admin/banners/${id}` : "/admin/banners",
        id ? "PUT" : "POST",
        body,
      );
      setRows((rs) => (id ? rs.map((x) => (x.id === id ? r : x)) : [...rs, r]));
      setD(null);
      toast({ tone: "success", title: "Banner saved" });
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const move = async (i: number, dir: -1 | 1) => {
    const next = [...rows];
    [next[i], next[i + dir]] = [next[i + dir]!, next[i]!];
    setRows(next);
    await orderApi("/admin/banners/order", "POST", { ids: next.map((r) => r.id) }).catch(
      (e: Error) => toast({ tone: "warning", title: e.message }),
    );
  };
  return (
    <Card>
      <CardHeader
        title="Homepage hero slides"
        sub="Shown in this order. Without active slides the built-in ones are shown."
        action={
          <Button size="sm" variant="accent" onClick={() => setD({ ...BLANK })}>
            <Plus size={14} /> New slide
          </Button>
        }
      />
      {rows.length === 0 ? (
        <p className="p-5 text-sm text-muted">No slides yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((b, i) => (
            <li key={b.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <button className="min-w-0 flex-1 text-left" onClick={() => setD({ ...b })}>
                <span className={cn("block font-semibold", !b.active && "text-muted line-through")}>
                  {[b.pre, b.main, b.post].filter(Boolean).join(" ")}
                </span>
                <span className="text-[11px] text-muted">
                  {b.tone}
                  {b.ctaLabel && ` · button “${b.ctaLabel}” → ${b.ctaHref}`}
                </span>
              </button>
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
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={!!d}
        onClose={() => setD(null)}
        title={d?.id ? "Edit slide" : "New slide"}
        footer={
          <Button variant="accent" onClick={() => d && save(d)}>
            Save
          </Button>
        }
      >
        {d && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First line" htmlFor="bn-pre">
              <input
                id="bn-pre"
                className="input"
                value={d.pre}
                onChange={(e) => setD({ ...d, pre: e.target.value })}
              />
            </Field>
            <Field label="Highlighted line" htmlFor="bn-main">
              <input
                id="bn-main"
                className="input"
                value={d.main}
                onChange={(e) => setD({ ...d, main: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Last line" htmlFor="bn-post">
                <input
                  id="bn-post"
                  className="input"
                  value={d.post}
                  onChange={(e) => setD({ ...d, post: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Button text (optional)" htmlFor="bn-cl">
              <input
                id="bn-cl"
                className="input"
                value={d.ctaLabel ?? ""}
                onChange={(e) => setD({ ...d, ctaLabel: e.target.value || null })}
              />
            </Field>
            <Field label="Button link" htmlFor="bn-ch" hint="/order/new or https://…">
              <input
                id="bn-ch"
                className="input"
                value={d.ctaHref ?? ""}
                onChange={(e) => setD({ ...d, ctaHref: e.target.value || null })}
              />
            </Field>
            <Field label="Colour" htmlFor="bn-t">
              <select
                id="bn-t"
                className="input"
                value={d.tone}
                onChange={(e) => setD({ ...d, tone: e.target.value as Banner["tone"] })}
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <label className="mt-6 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={d.active}
                onChange={(e) => setD({ ...d, active: e.target.checked })}
              />{" "}
              Show on the homepage
            </label>
            {err && <p className="text-sm text-danger sm:col-span-2">{err}</p>}
          </div>
        )}
      </Modal>
    </Card>
  );
}

// ---- Student profile ------------------------------------------------------------------

export interface StudentProfileData {
  institution: string;
  classLevel: string;
  board: string | null;
  subjects: string[];
  showOnLeaderboard: boolean;
}

/** The marketplace part of a student's profile (name, email, phone live in the WAN ID). */
export function StudentProfileLive({
  initial,
  name,
  subjects,
}: {
  initial: StudentProfileData;
  name: string;
  subjects: { id: string; name: string }[];
}) {
  const toast = useToast();
  const [f, setF] = useState(initial);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader
        title="Marketplace profile"
        sub="Name, email, phone and password are managed in your WAN ID."
      />
      <form
        noValidate
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr("");
          try {
            await orderApi("/me/student-profile", "PUT", f);
            toast({ tone: "success", title: "Profile saved" });
          } catch (x) {
            setErr((x as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="font-bold">{name}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Institution" required htmlFor="sp-i">
            <input
              id="sp-i"
              className="input"
              value={f.institution}
              onChange={(e) => setF({ ...f, institution: e.target.value })}
            />
          </Field>
          <Field label="Class / year" required htmlFor="sp-c">
            <input
              id="sp-c"
              className="input"
              value={f.classLevel}
              onChange={(e) => setF({ ...f, classLevel: e.target.value })}
            />
          </Field>
          <Field label="Board (optional)" htmlFor="sp-b">
            <input
              id="sp-b"
              className="input"
              value={f.board ?? ""}
              onChange={(e) => setF({ ...f, board: e.target.value || null })}
            />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Subjects</legend>
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => {
              const on = f.subjects.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setF({
                      ...f,
                      subjects: on ? f.subjects.filter((x) => x !== s.id) : [...f.subjects, s.id],
                    })
                  }
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold ring-1",
                    on ? "bg-brand-600 text-white ring-brand-600" : "ring-line",
                  )}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={f.showOnLeaderboard}
            onChange={(e) => setF({ ...f, showOnLeaderboard: e.target.checked })}
          />
          <span>
            Show me on the public student leaderboard
            <span className="block text-xs text-muted">
              Only your first name, last initial, institution and points are shown.
            </span>
          </span>
        </label>
        {err && <p className="text-sm text-danger">{err}</p>}
        <Button type="submit" variant="accent" disabled={busy}>
          Save profile
        </Button>
      </form>
    </Card>
  );
}
