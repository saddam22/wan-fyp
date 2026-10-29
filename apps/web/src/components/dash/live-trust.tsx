"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, CheckCircle2, Clock, FileText, Trash2, Upload, XCircle } from "lucide-react";
import { formatDate, formatMoney } from "@edukhata/contracts";
import { Badge, Button, Card, CardHeader, EmptyState, Field } from "@/components/ui";
import { DataTable, Modal, useToast } from "@/components/ui/client";
import { useT } from "@/lib/i18n/client";
import { orderApi } from "@/lib/order-api";

const bdt = (minor: number) => ({ amountMinor: minor, currency: "BDT" as const });

// ---- Verification ---------------------------------------------------------------------

export interface VFile {
  id: string;
  kind: "identity" | "qualification" | "institution" | "other";
  name: string;
  contentType: string;
  byteSize: number;
  /** Deleted after the retention period (6 months after the decision). */
  deletedAt?: string;
}
export interface VRequest {
  id: string;
  mentorId: string;
  mentorName: string | null;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  note: string;
  decisionNote: string | null;
  reviewedBy?: string | null;
  reviewedAt: string | null;
  createdAt: string;
  files: VFile[];
}
export interface VStatus {
  verified: boolean;
  verifiedAt: string | null;
  latest: VRequest | null;
  draftFiles: VFile[];
}

const KIND_LABEL: Record<VFile["kind"], string> = {
  identity: "Identity (NID, birth certificate or passport)",
  qualification: "Qualification (certificate or transcript)",
  institution: "Institution (student or staff ID)",
  other: "Other",
};
const V_STATUS: Record<VRequest["status"], [string, "amber" | "green" | "red" | "gray"]> = {
  pending: ["Under review", "amber"],
  approved: ["Approved", "green"],
  rejected: ["Not approved", "red"],
  withdrawn: ["Withdrawn", "gray"],
};

/** The mentor uploads documents (private; only reviewers see them) and asks for review. */
export function MentorVerificationLive({ status }: { status: VStatus }) {
  const { lang } = useT();
  const toast = useToast();
  const router = useRouter();
  const [kind, setKind] = useState<VFile["kind"]>("identity");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = status.latest?.status === "pending";

  async function upload(file: File) {
    setBusy(true);
    setErr("");
    try {
      const s = await orderApi<{ uploadUrl: string; headers: Record<string, string> }>(
        "/mentor/verification/files",
        "POST",
        { kind, name: file.name, contentType: file.type, byteSize: file.size },
      );
      const put = await fetch(s.uploadUrl, { method: "PUT", headers: s.headers, body: file });
      if (!put.ok)
        throw new Error(
          (await put.json().catch(() => null))?.error?.message ?? "The file could not be uploaded",
        );
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card
        className={`flex items-center gap-3 p-4 text-sm ${status.verified ? "bg-green-50 text-green-900" : "bg-slate-50"}`}
      >
        <BadgeCheck className={status.verified ? "text-success" : "text-muted"} />
        {status.verified ? (
          <span>
            You are <b>Verified</b> since {formatDate(status.verifiedAt!, lang)}. The badge means
            EduKhata staff checked your documents.
          </span>
        ) : pending ? (
          <span>Your documents are being reviewed. You will get a notification.</span>
        ) : (
          <span>
            Not verified yet. Verified mentors are shown first and are the only ones offered orders
            when EduKhata turns on &quot;verified only&quot;.
          </span>
        )}
      </Card>
      {status.latest && (
        <Card className="p-5 text-sm">
          <p className="flex items-center gap-2 font-bold">
            Last request{" "}
            <Badge tone={V_STATUS[status.latest.status][1]}>
              {V_STATUS[status.latest.status][0]}
            </Badge>
          </p>
          <p className="mt-1 text-xs text-muted">
            Sent {formatDate(status.latest.createdAt, lang, true)} · {status.latest.files.length}{" "}
            document(s)
          </p>
          {status.latest.decisionNote && (
            <p className="mt-2">Reviewer: {status.latest.decisionNote}</p>
          )}
        </Card>
      )}
      {!status.verified && !pending && (
        <Card>
          <CardHeader
            title="Documents"
            sub="JPG, PNG or PDF up to 8 MB. Photos lose their location data. Only EduKhata reviewers can open them, and they are deleted 6 months after the decision."
          />
          <div className="space-y-4 p-5">
            {status.draftFiles.length === 0 ? (
              <p className="text-sm text-muted">No documents yet.</p>
            ) : (
              <ul className="divide-y divide-line rounded-lg ring-1 ring-line">
                {status.draftFiles.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <FileText size={16} className="text-muted" />
                    <span className="min-w-0 flex-1 truncate">
                      {f.name} <span className="text-xs text-muted">· {KIND_LABEL[f.kind]}</span>
                    </span>
                    <button
                      aria-label={`Remove ${f.name}`}
                      className="text-muted hover:text-danger"
                      onClick={async () => {
                        await orderApi(`/mentor/verification/files/${f.id}`, "DELETE").catch(
                          () => undefined,
                        );
                        router.refresh();
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Field label="Type of document" htmlFor="vk">
                <select
                  id="vk"
                  className="input"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as VFile["kind"])}
                >
                  {Object.entries(KIND_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="mt-auto inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] px-4 text-sm font-semibold ring-1 ring-line hover:bg-slate-50">
                <Upload size={15} /> {busy ? "Uploading…" : "Add file"}
                <input
                  type="file"
                  className="sr-only"
                  data-testid="verification-file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void upload(f);
                  }}
                />
              </label>
            </div>
            <Field label="Note for the reviewer (optional)" htmlFor="vn" error={err}>
              <textarea
                id="vn"
                rows={2}
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <Button
              variant="accent"
              disabled={busy}
              onClick={async () => {
                setErr("");
                try {
                  await orderApi("/mentor/verification", "POST", { note });
                  toast({ tone: "success", title: "Sent for review" });
                  router.refresh();
                } catch (e) {
                  setErr((e as Error).message);
                }
              }}
            >
              Send for review
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

/** Reviewers open each document, then approve or send back with a reason. */
export function VerificationQueueLive({ items }: { items: VRequest[] }) {
  const { lang } = useT();
  const toast = useToast();
  const [rows, setRows] = useState(items);
  const [sel, setSel] = useState<VRequest | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const decide = async (approve: boolean) => {
    if (!sel) return;
    setErr("");
    try {
      const u = await orderApi<VRequest>(`/admin/verifications/${sel.id}/decision`, "POST", {
        approve,
        note,
      });
      setRows((rs) => rs.map((r) => (r.id === u.id ? u : r)));
      toast({
        tone: "success",
        title: approve ? `${sel.mentorName} is verified` : "Sent back to the mentor",
      });
      setSel(null);
      setNote("");
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Card>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={(r) => (setSel(r), setErr(""), setNote(""))}
        searchText={(r) => `${r.mentorName ?? ""} ${r.note}`}
        filters={{
          label: "Status",
          options: Object.entries(V_STATUS).map(([value, v]) => ({ value, label: v[0] })),
          test: (r, v) => r.status === v,
        }}
        empty={{ title: "No verification requests" }}
        columns={[
          { key: "m", header: "Mentor", cell: (r) => <b>{r.mentorName}</b> },
          { key: "f", header: "Documents", cell: (r) => r.files.map((f) => f.kind).join(", ") },
          {
            key: "d",
            header: "Sent",
            cell: (r) => formatDate(r.createdAt, lang, true),
            sort: (r) => r.createdAt,
          },
          {
            key: "s",
            header: "Status",
            cell: (r) => <Badge tone={V_STATUS[r.status][1]}>{V_STATUS[r.status][0]}</Badge>,
          },
        ]}
      />
      <Modal
        open={!!sel}
        onClose={() => setSel(null)}
        title={`Verification · ${sel?.mentorName ?? ""}`}
        size="lg"
        footer={
          sel?.status === "pending" ? (
            <>
              <Button variant="outline" onClick={() => decide(false)}>
                <XCircle size={16} /> Send back
              </Button>
              <Button variant="success" onClick={() => decide(true)}>
                <CheckCircle2 size={16} /> Approve
              </Button>
            </>
          ) : undefined
        }
      >
        {sel && (
          <div className="space-y-4 text-sm">
            {sel.note && <p>Mentor&apos;s note: {sel.note}</p>}
            <ul className="space-y-2">
              {sel.files.map((f) => (
                <li key={f.id}>
                  {f.deletedAt ? (
                    <span className="flex items-center gap-2 text-muted">
                      <FileText size={15} /> {KIND_LABEL[f.kind]} — deleted after 6 months
                    </span>
                  ) : (
                    <a
                      href={`/api/verification-files/${f.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 font-semibold text-[var(--color-accent)]"
                    >
                      <FileText size={15} /> {KIND_LABEL[f.kind]} — {f.name}
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              Check that the name matches the WAN ID, the document is readable and not expired.
              Opening a document is recorded in the audit log.
            </p>
            {sel.status === "pending" ? (
              <Field label="Note to the mentor (required to send back)" htmlFor="vd" error={err}>
                <textarea
                  id="vd"
                  rows={2}
                  className="input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
            ) : (
              <p className="text-muted">
                {V_STATUS[sel.status][0]} by {sel.reviewedBy ?? "—"}
                {sel.decisionNote && ` · ${sel.decisionNote}`}
              </p>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}

// ---- Skill tests ----------------------------------------------------------------------

export interface MentorTest {
  id: string;
  subject: string;
  title: string;
  passPct: number;
  durationMin: number;
  questionCount: number;
  passed: boolean;
  lastScorePct: number | null;
  retakeAt: string | null;
  openAttemptId: string | null;
}
interface Attempt {
  attemptId: string;
  deadline: string;
  questions: { id: string; prompt: string; options: string[] }[];
}

function useCountdown(deadline: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return "";
  const left = Math.max(0, new Date(deadline).getTime() - now);
  return `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
}

/** Take a test: questions without answers, a countdown, graded on the server. */
export function SkillTestsLive({ tests }: { tests: MentorTest[] }) {
  const { lang } = useT();
  const toast = useToast();
  const router = useRouter();
  const [att, setAtt] = useState<(Attempt & { title: string }) | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{
    scorePct: number;
    passed: boolean;
    passPct: number;
  } | null>(null);
  const left = useCountdown(att?.deadline ?? null);
  if (!tests.length)
    return (
      <Card>
        <EmptyState title="No skill tests yet" body="EduKhata adds tests per subject." />
      </Card>
    );
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tests.map((t) => (
          <Card key={t.id} className="flex flex-col gap-2 p-5">
            <p className="font-bold">{t.title}</p>
            <p className="text-xs text-muted">
              {t.subject} · {t.questionCount} questions · {t.durationMin} min · pass {t.passPct}%
            </p>
            {t.passed ? (
              <Badge tone="green">Passed — badge earned</Badge>
            ) : t.retakeAt ? (
              <p className="text-xs text-muted">
                Last score {t.lastScorePct}%. Retake from {formatDate(t.retakeAt, lang)}.
              </p>
            ) : (
              <Button
                variant="accent"
                className="mt-auto"
                onClick={async () => {
                  try {
                    const a = await orderApi<Attempt>(`/mentor/skill-tests/${t.id}/start`, "POST");
                    setAnswers({});
                    setResult(null);
                    setAtt({ ...a, title: t.title });
                  } catch (e) {
                    toast({ tone: "warning", title: (e as Error).message });
                  }
                }}
              >
                {t.openAttemptId
                  ? "Continue test"
                  : t.lastScorePct !== null
                    ? "Retake test"
                    : "Start test"}
              </Button>
            )}
          </Card>
        ))}
      </div>
      <Modal
        open={!!att}
        onClose={() => (setAtt(null), router.refresh())}
        title={att ? `${att.title}${result ? "" : ` · ${left} left`}` : ""}
        size="lg"
        footer={
          result ? (
            <Button variant="accent" onClick={() => (setAtt(null), router.refresh())}>
              Done
            </Button>
          ) : (
            <Button
              variant="accent"
              onClick={async () => {
                try {
                  setResult(
                    await orderApi(`/mentor/skill-attempts/${att!.attemptId}/submit`, "POST", {
                      answers,
                    }),
                  );
                } catch (e) {
                  toast({ tone: "warning", title: (e as Error).message });
                }
              }}
            >
              Submit answers ({Object.keys(answers).length}/{att?.questions.length})
            </Button>
          )
        }
      >
        {result ? (
          <div className="py-6 text-center">
            <p className="text-3xl font-extrabold">{result.scorePct}%</p>
            <p
              className={result.passed ? "font-semibold text-success" : "font-semibold text-danger"}
            >
              {result.passed
                ? "Passed — the badge is on your profile"
                : `Not passed (${result.passPct}% needed)`}
            </p>
          </div>
        ) : (
          <ol className="space-y-5">
            {att?.questions.map((q, i) => (
              <li key={q.id}>
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">
                    {i + 1}. {q.prompt}
                  </legend>
                  <div className="space-y-1.5">
                    {q.options.map((o, j) => (
                      <label key={j} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={q.id}
                          checked={answers[q.id] === j}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: j }))}
                        />
                        {o}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </li>
            ))}
          </ol>
        )}
      </Modal>
    </>
  );
}

export interface AdminTest {
  id: string;
  subjectId: string;
  subject: string;
  title: string;
  passPct: number;
  durationMin: number;
  active: boolean;
  questionCount: number;
  attemptCount: number;
}
interface QDraft {
  prompt: string;
  options: string[];
  correct: number;
}
const blankQ = (): QDraft => ({ prompt: "", options: ["", ""], correct: 0 });

/** Admins write tests: questions with 2–6 options and the right one marked. */
export function SkillTestsAdmin({
  tests,
  subjects,
}: {
  tests: AdminTest[];
  subjects: { id: string; name: string }[];
}) {
  const toast = useToast();
  const [rows, setRows] = useState(tests);
  const [draft, setDraft] = useState<{
    subjectId: string;
    title: string;
    passPct: number;
    durationMin: number;
    questions: QDraft[];
  } | null>(null);
  const [err, setErr] = useState("");
  const setQ = (i: number, q: Partial<QDraft>) =>
    draft &&
    setDraft({
      ...draft,
      questions: draft.questions.map((x, j) => (j === i ? { ...x, ...q } : x)),
    });
  return (
    <Card>
      <DataTable
        rows={rows}
        rowKey={(t) => t.id}
        empty={{ title: "No tests yet" }}
        toolbar={
          <Button
            size="sm"
            variant="accent"
            onClick={() =>
              setDraft({
                subjectId: subjects[0]?.id ?? "",
                title: "",
                passPct: 70,
                durationMin: 20,
                questions: [blankQ(), blankQ(), blankQ()],
              })
            }
          >
            New test
          </Button>
        }
        columns={[
          { key: "t", header: "Test", cell: (t) => <b>{t.title}</b> },
          { key: "s", header: "Subject", cell: (t) => t.subject },
          { key: "q", header: "Questions", cell: (t) => t.questionCount },
          { key: "p", header: "Pass", cell: (t) => `${t.passPct}% · ${t.durationMin} min` },
          { key: "a", header: "Attempts", cell: (t) => t.attemptCount },
          {
            key: "x",
            header: "",
            cell: (t) => (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    const u = await orderApi<AdminTest>(`/admin/skill-tests/${t.id}`, "PUT", {
                      title: t.title,
                      passPct: t.passPct,
                      durationMin: t.durationMin,
                      active: !t.active,
                    });
                    setRows((rs) => rs.map((r) => (r.id === u.id ? u : r)));
                  } catch (e) {
                    toast({ tone: "warning", title: (e as Error).message });
                  }
                }}
              >
                {t.active ? "Turn off" : "Turn on"}
              </Button>
            ),
          },
        ]}
      />
      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title="New skill test"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={async () => {
                setErr("");
                try {
                  const t = await orderApi<AdminTest>("/admin/skill-tests", "POST", draft!);
                  setRows((rs) => [...rs, t]);
                  setDraft(null);
                  toast({ tone: "success", title: "Test saved" });
                } catch (e) {
                  setErr((e as Error).message);
                }
              }}
            >
              Save test
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Subject" htmlFor="st-s">
                <select
                  id="st-s"
                  className="input"
                  value={draft.subjectId}
                  onChange={(e) => setDraft({ ...draft, subjectId: e.target.value })}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Title" htmlFor="st-t">
                <input
                  id="st-t"
                  className="input"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </Field>
              <Field label="Pass mark (%)" htmlFor="st-p">
                <input
                  id="st-p"
                  type="number"
                  className="input"
                  value={draft.passPct}
                  onChange={(e) => setDraft({ ...draft, passPct: Number(e.target.value) })}
                />
              </Field>
              <Field label="Time (minutes)" htmlFor="st-d">
                <input
                  id="st-d"
                  type="number"
                  className="input"
                  value={draft.durationMin}
                  onChange={(e) => setDraft({ ...draft, durationMin: Number(e.target.value) })}
                />
              </Field>
            </div>
            {draft.questions.map((q, i) => (
              <fieldset key={i} className="space-y-2 rounded-lg p-3 ring-1 ring-line">
                <legend className="px-1 text-xs font-semibold text-muted">Question {i + 1}</legend>
                <input
                  aria-label={`Question ${i + 1}`}
                  className="input"
                  value={q.prompt}
                  onChange={(e) => setQ(i, { prompt: e.target.value })}
                />
                {q.options.map((o, j) => (
                  <label key={j} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`c${i}`}
                      aria-label={`Option ${j + 1} is right`}
                      checked={q.correct === j}
                      onChange={() => setQ(i, { correct: j })}
                    />
                    <input
                      aria-label={`Question ${i + 1} option ${j + 1}`}
                      className="input"
                      value={o}
                      onChange={(e) =>
                        setQ(i, {
                          options: q.options.map((x, k) => (k === j ? e.target.value : x)),
                        })
                      }
                    />
                  </label>
                ))}
                {q.options.length < 6 && (
                  <button
                    className="text-xs font-semibold text-[var(--color-accent)]"
                    onClick={() => setQ(i, { options: [...q.options, ""] })}
                  >
                    + option
                  </button>
                )}
              </fieldset>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDraft({ ...draft, questions: [...draft.questions, blankQ()] })}
            >
              Add question
            </Button>
            {err && <p className="text-sm text-danger">{err}</p>}
          </div>
        )}
      </Modal>
    </Card>
  );
}

// ---- Promotions -----------------------------------------------------------------------

export interface Promo {
  id: string;
  mentorId: string;
  mentorName?: string;
  kind: "boost" | "pro_monthly" | "pro_yearly";
  label: string;
  price: { amountMinor: number; currency: "BDT" };
  startsAt: string;
  endsAt: string;
  status: "active" | "expired" | "cancelled";
}
export interface PromoData {
  availableMinor: number;
  plans: { kind: Promo["kind"]; label: string; days: number; priceMinor: number }[];
  items: Promo[];
}

const PLAN_TEXT: Record<Promo["kind"], string> = {
  boost: "Shown in the “Featured” strip on the mentors page, labelled as paid.",
  pro_monthly: "A “Pro” label on your profile, marked as paid.",
  pro_yearly: "A “Pro” label for a year, marked as paid.",
};

/** Buy a boost or Pro from available earnings. Paid labels never affect ranking or offers. */
export function PromoteLive({ data }: { data: PromoData }) {
  const { lang } = useT();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-5">
      <Card className="p-4 text-sm">
        Paid from your available earnings: <b>{formatMoney(bdt(data.availableMinor), lang)}</b>.
        Promotions are labelled &quot;paid&quot;; they don&apos;t make you verified and don&apos;t
        change how orders are matched. They don&apos;t renew by themselves.
      </Card>
      <div className="grid gap-3 sm:grid-cols-3">
        {data.plans.map((p) => (
          <Card key={p.kind} className="flex flex-col gap-2 p-5">
            <p className="font-bold">{p.label}</p>
            <p className="text-2xl font-extrabold">{formatMoney(bdt(p.priceMinor), lang)}</p>
            <p className="text-sm text-muted">{PLAN_TEXT[p.kind]}</p>
            <Button
              variant="accent"
              className="mt-auto"
              disabled={busy || p.priceMinor > data.availableMinor}
              onClick={async () => {
                setBusy(true);
                try {
                  await orderApi("/mentor/promotions", "POST", { kind: p.kind });
                  toast({ tone: "success", title: `${p.label} bought` });
                  router.refresh();
                } catch (e) {
                  toast({ tone: "warning", title: (e as Error).message });
                } finally {
                  setBusy(false);
                }
              }}
            >
              {p.priceMinor > data.availableMinor ? "Not enough available" : "Buy"}
            </Button>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader title="Your promotions" />
        {data.items.length === 0 ? (
          <p className="p-5 text-sm text-muted">None yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.items.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <Clock size={15} className="text-muted" />
                <span className="flex-1">
                  <b>{p.label}</b> · {formatDate(p.startsAt, lang)} – {formatDate(p.endsAt, lang)}
                </span>
                <span>{formatMoney(p.price, lang)}</span>
                <Badge tone={p.status === "active" ? "green" : "gray"}>{p.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function PromotionsAdmin({ items }: { items: Promo[] }) {
  const { lang } = useT();
  const toast = useToast();
  const [rows, setRows] = useState(items);
  const [stop, setStop] = useState<{ p: Promo; note: string } | null>(null);
  return (
    <Card>
      <DataTable
        rows={rows}
        rowKey={(p) => p.id}
        searchText={(p) => `${p.mentorName ?? ""} ${p.label}`}
        empty={{ title: "No promotions bought yet" }}
        columns={[
          { key: "m", header: "Mentor", cell: (p) => <b>{p.mentorName}</b> },
          { key: "k", header: "Promotion", cell: (p) => p.label },
          {
            key: "d",
            header: "Period",
            cell: (p) => `${formatDate(p.startsAt, lang)} – ${formatDate(p.endsAt, lang)}`,
          },
          { key: "a", header: "Paid", cell: (p) => formatMoney(p.price, lang) },
          {
            key: "s",
            header: "Status",
            cell: (p) => <Badge tone={p.status === "active" ? "green" : "gray"}>{p.status}</Badge>,
          },
          {
            key: "x",
            header: "",
            cell: (p) =>
              p.status === "active" ? (
                <Button size="sm" variant="outline" onClick={() => setStop({ p, note: "" })}>
                  Stop
                </Button>
              ) : null,
          },
        ]}
      />
      <Modal
        open={!!stop}
        onClose={() => setStop(null)}
        title={`Stop ${stop?.p.label} for ${stop?.p.mentorName}`}
        footer={
          <Button
            variant="danger"
            disabled={(stop?.note.trim().length ?? 0) < 3}
            onClick={async () => {
              try {
                const u = await orderApi<Promo>(`/admin/promotions/${stop!.p.id}/cancel`, "POST", {
                  note: stop!.note,
                });
                setRows((rs) => rs.map((r) => (r.id === u.id ? { ...r, ...u } : r)));
                setStop(null);
                toast({ tone: "success", title: "Stopped; unused days returned to the mentor" });
              } catch (e) {
                toast({ tone: "warning", title: (e as Error).message });
              }
            }}
          >
            Stop promotion
          </Button>
        }
      >
        <Field label="Reason (shown in the audit log)" htmlFor="ps-n">
          <textarea
            id="ps-n"
            rows={2}
            className="input"
            value={stop?.note ?? ""}
            onChange={(e) => stop && setStop({ ...stop, note: e.target.value })}
          />
        </Field>
      </Modal>
    </Card>
  );
}

// ---- Coupons --------------------------------------------------------------------------

export interface Coupon {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  maxDiscountMinor: number | null;
  minOrderMinor: number;
  maxUses: number | null;
  perUser: number;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  uses: number;
  discountGivenMinor: number;
}

export function CouponsAdmin({ items }: { items: Coupon[] }) {
  const { lang } = useT();
  const toast = useToast();
  const [rows, setRows] = useState(items);
  const [d, setD] = useState<{
    code: string;
    kind: "percent" | "fixed";
    value: string;
    cap: string;
    min: string;
    maxUses: string;
    endsAt: string;
  } | null>(null);
  const [err, setErr] = useState("");
  const taka = (v: string) => (v.trim() ? Math.round(Number(v) * 100) : null);
  return (
    <Card>
      <DataTable
        rows={rows}
        rowKey={(c) => c.id}
        searchText={(c) => c.code}
        empty={{ title: "No coupons" }}
        toolbar={
          <Button
            size="sm"
            variant="accent"
            onClick={() =>
              setD({
                code: "",
                kind: "percent",
                value: "",
                cap: "",
                min: "",
                maxUses: "",
                endsAt: "",
              })
            }
          >
            New coupon
          </Button>
        }
        columns={[
          {
            key: "c",
            header: "Code",
            cell: (c) => <span className="font-mono font-bold">{c.code}</span>,
          },
          {
            key: "v",
            header: "Discount",
            cell: (c) =>
              c.kind === "percent"
                ? `${c.value}%${c.maxDiscountMinor ? ` (max ${formatMoney(bdt(c.maxDiscountMinor), lang)})` : ""}`
                : formatMoney(bdt(c.value), lang),
          },
          {
            key: "m",
            header: "Min order",
            cell: (c) => (c.minOrderMinor ? formatMoney(bdt(c.minOrderMinor), lang) : "—"),
          },
          {
            key: "u",
            header: "Used",
            cell: (c) => `${c.uses}${c.maxUses ? ` / ${c.maxUses}` : ""}`,
          },
          { key: "g", header: "Given", cell: (c) => formatMoney(bdt(c.discountGivenMinor), lang) },
          { key: "e", header: "Ends", cell: (c) => (c.endsAt ? formatDate(c.endsAt, lang) : "—") },
          {
            key: "x",
            header: "",
            cell: (c) => (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const u = await orderApi<Coupon>(`/admin/coupons/${c.id}`, "PUT", {
                    maxUses: c.maxUses,
                    perUser: c.perUser,
                    startsAt: c.startsAt,
                    endsAt: c.endsAt,
                    active: !c.active,
                  }).catch((e: Error) => (toast({ tone: "warning", title: e.message }), null));
                  if (u) setRows((rs) => rs.map((r) => (r.id === u.id ? u : r)));
                }}
              >
                {c.active ? "Switch off" : "Switch on"}
              </Button>
            ),
          },
        ]}
      />
      <Modal
        open={!!d}
        onClose={() => setD(null)}
        title="New coupon"
        footer={
          <Button
            variant="accent"
            onClick={async () => {
              setErr("");
              try {
                const c = await orderApi<Coupon>("/admin/coupons", "POST", {
                  code: d!.code,
                  kind: d!.kind,
                  value: d!.kind === "percent" ? Number(d!.value) : taka(d!.value),
                  maxDiscountMinor: taka(d!.cap),
                  minOrderMinor: taka(d!.min) ?? 0,
                  maxUses: d!.maxUses.trim() ? Number(d!.maxUses) : null,
                  endsAt: d!.endsAt ? new Date(d!.endsAt).toISOString() : null,
                });
                setRows((rs) => [c, ...rs]);
                setD(null);
                toast({ tone: "success", title: `${c.code} created` });
              } catch (e) {
                setErr((e as Error).message);
              }
            }}
          >
            Create
          </Button>
        }
      >
        {d && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code" htmlFor="cp-c">
              <input
                id="cp-c"
                className="input font-mono uppercase"
                value={d.code}
                onChange={(e) => setD({ ...d, code: e.target.value })}
              />
            </Field>
            <Field label="Type" htmlFor="cp-k">
              <select
                id="cp-k"
                className="input"
                value={d.kind}
                onChange={(e) => setD({ ...d, kind: e.target.value as "percent" })}
              >
                <option value="percent">Percent</option>
                <option value="fixed">Fixed amount (৳)</option>
              </select>
            </Field>
            <Field label={d.kind === "percent" ? "Percent" : "Amount (৳)"} htmlFor="cp-v">
              <input
                id="cp-v"
                type="number"
                className="input"
                value={d.value}
                onChange={(e) => setD({ ...d, value: e.target.value })}
              />
            </Field>
            {d.kind === "percent" && (
              <Field label="Max discount (৳, optional)" htmlFor="cp-cap">
                <input
                  id="cp-cap"
                  type="number"
                  className="input"
                  value={d.cap}
                  onChange={(e) => setD({ ...d, cap: e.target.value })}
                />
              </Field>
            )}
            <Field label="Minimum order (৳)" htmlFor="cp-m">
              <input
                id="cp-m"
                type="number"
                className="input"
                value={d.min}
                onChange={(e) => setD({ ...d, min: e.target.value })}
              />
            </Field>
            <Field label="Total uses (optional)" htmlFor="cp-u">
              <input
                id="cp-u"
                type="number"
                className="input"
                value={d.maxUses}
                onChange={(e) => setD({ ...d, maxUses: e.target.value })}
              />
            </Field>
            <Field label="Ends (optional)" htmlFor="cp-e">
              <input
                id="cp-e"
                type="date"
                className="input"
                value={d.endsAt}
                onChange={(e) => setD({ ...d, endsAt: e.target.value })}
              />
            </Field>
            <p className="text-xs text-muted sm:col-span-2">
              One use per person. The discount is shared by EduKhata and the mentor in the
              order&apos;s 20/80 split. Orders never cost less than ৳10.
            </p>
            {err && <p className="text-sm text-danger sm:col-span-2">{err}</p>}
          </div>
        )}
      </Modal>
    </Card>
  );
}

// ---- Content --------------------------------------------------------------------------

export interface Post {
  id: string;
  kind: "blog" | "page";
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  status: "draft" | "pending" | "published" | "rejected" | "hidden";
  authorName: string;
  reviewNote: string | null;
  publishedAt: string | null;
  updatedAt: string;
}
const P_STATUS: Record<Post["status"], [string, "gray" | "amber" | "green" | "red"]> = {
  draft: ["Draft", "gray"],
  pending: ["Waiting for review", "amber"],
  published: ["Published", "green"],
  rejected: ["Sent back", "red"],
  hidden: ["Hidden", "gray"],
};
const CATS = ["general", "study-tips", "practical-khata", "exams", "mentors"];

type Draft = Pick<Post, "title" | "excerpt" | "body" | "category"> & { id?: string; slug?: string };

function PostForm({ d, set, page }: { d: Draft; set: (d: Draft) => void; page?: boolean }) {
  return (
    <div className="space-y-3">
      <Field label="Title" htmlFor="pf-t">
        <input
          id="pf-t"
          className="input"
          value={d.title}
          onChange={(e) => set({ ...d, title: e.target.value })}
        />
      </Field>
      {page && !d.id && (
        <Field label="Address (/p/…)" htmlFor="pf-s" hint="lowercase-with-dashes">
          <input
            id="pf-s"
            className="input font-mono"
            value={d.slug ?? ""}
            onChange={(e) => set({ ...d, slug: e.target.value })}
          />
        </Field>
      )}
      {!page && (
        <Field label="Category" htmlFor="pf-c">
          <select
            id="pf-c"
            className="input"
            value={d.category}
            onChange={(e) => set({ ...d, category: e.target.value })}
          >
            {CATS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Summary" htmlFor="pf-e">
        <input
          id="pf-e"
          className="input"
          value={d.excerpt}
          onChange={(e) => set({ ...d, excerpt: e.target.value })}
        />
      </Field>
      <Field
        label="Text"
        htmlFor="pf-b"
        hint="Plain text. Blank line = new paragraph, “## ” = heading, “- ” = list item."
      >
        <textarea
          id="pf-b"
          rows={12}
          className="input"
          value={d.body}
          onChange={(e) => set({ ...d, body: e.target.value })}
        />
      </Field>
    </div>
  );
}

/** Admin: write pages and posts, review submitted posts, hide or republish. */
export function ContentAdmin({ items, kind }: { items: Post[]; kind: "blog" | "page" }) {
  const { lang } = useT();
  const toast = useToast();
  const [rows, setRows] = useState(items);
  const [d, setD] = useState<Draft | null>(null);
  const [review, setReview] = useState<{ p: Post; note: string } | null>(null);
  const [err, setErr] = useState("");
  const upsert = (p: Post) =>
    setRows((rs) =>
      rs.some((r) => r.id === p.id) ? rs.map((r) => (r.id === p.id ? p : r)) : [p, ...rs],
    );
  const save = async (status?: "published" | "hidden" | "draft") => {
    if (!d) return;
    setErr("");
    try {
      const p = d.id
        ? await orderApi<Post>(`/admin/content/${d.id}`, "PUT", {
            ...d,
            ...(status ? { status } : {}),
          })
        : await orderApi<Post>("/admin/content", "POST", {
            ...d,
            kind,
            publish: status === "published",
          });
      upsert(p);
      setD(null);
      toast({ tone: "success", title: "Saved" });
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Card>
      <DataTable
        rows={rows}
        rowKey={(p) => p.id}
        searchText={(p) => `${p.title} ${p.authorName}`}
        filters={{
          label: "Status",
          options: Object.entries(P_STATUS).map(([value, v]) => ({ value, label: v[0] })),
          test: (p, v) => p.status === v,
        }}
        empty={{ title: kind === "blog" ? "No posts yet" : "No pages yet" }}
        toolbar={
          <Button
            size="sm"
            variant="accent"
            onClick={() => setD({ title: "", excerpt: "", body: "", category: "general" })}
          >
            {kind === "blog" ? "New post" : "New page"}
          </Button>
        }
        onRowClick={(p) => (p.status === "pending" ? setReview({ p, note: "" }) : setD({ ...p }))}
        columns={[
          { key: "t", header: "Title", cell: (p) => <b>{p.title}</b> },
          { key: "a", header: "Author", cell: (p) => p.authorName },
          {
            key: "u",
            header: "Updated",
            cell: (p) => formatDate(p.updatedAt, lang),
            sort: (p) => p.updatedAt,
          },
          {
            key: "s",
            header: "Status",
            cell: (p) => <Badge tone={P_STATUS[p.status][1]}>{P_STATUS[p.status][0]}</Badge>,
          },
        ]}
      />
      <Modal
        open={!!d}
        onClose={() => setD(null)}
        title={d?.id ? "Edit" : kind === "blog" ? "New post" : "New page"}
        size="lg"
        footer={
          <>
            {d?.id && (
              <Button variant="outline" onClick={() => save("hidden")}>
                Hide
              </Button>
            )}
            <Button variant="outline" onClick={() => save(d?.id ? undefined : "draft")}>
              Save
            </Button>
            <Button variant="accent" onClick={() => save("published")}>
              Publish
            </Button>
          </>
        }
      >
        {d && <PostForm d={d} set={setD} page={kind === "page"} />}
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}
      </Modal>
      <Modal
        open={!!review}
        onClose={() => setReview(null)}
        title={`Review: ${review?.p.title ?? ""}`}
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  upsert(
                    await orderApi<Post>(`/admin/content/${review!.p.id}/review`, "POST", {
                      publish: false,
                      note: review!.note,
                    }),
                  );
                  setReview(null);
                } catch (e) {
                  toast({ tone: "warning", title: (e as Error).message });
                }
              }}
            >
              Send back
            </Button>
            <Button
              variant="success"
              onClick={async () => {
                try {
                  upsert(
                    await orderApi<Post>(`/admin/content/${review!.p.id}/review`, "POST", {
                      publish: true,
                    }),
                  );
                  setReview(null);
                  toast({ tone: "success", title: "Published" });
                } catch (e) {
                  toast({ tone: "warning", title: (e as Error).message });
                }
              }}
            >
              Publish
            </Button>
          </>
        }
      >
        {review && (
          <div className="space-y-3 text-sm">
            <p className="text-muted">
              By {review.p.authorName} · {review.p.category}
            </p>
            <PostText body={review.p.body} />
            <Field label="Note to the author (required to send back)" htmlFor="rv-n">
              <textarea
                id="rv-n"
                rows={2}
                className="input"
                value={review.note}
                onChange={(e) => setReview({ ...review, note: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>
    </Card>
  );
}

/** Mentor: write posts, send them for review, fix what the reviewer asked. */
export function MyPosts({ items }: { items: Post[] }) {
  const { lang } = useT();
  const toast = useToast();
  const [rows, setRows] = useState(items);
  const [d, setD] = useState<Draft | null>(null);
  const [err, setErr] = useState("");
  const upsert = (p: Post) =>
    setRows((rs) =>
      rs.some((r) => r.id === p.id) ? rs.map((r) => (r.id === p.id ? p : r)) : [p, ...rs],
    );
  const save = async (submit: boolean) => {
    if (!d) return;
    setErr("");
    try {
      let p = d.id
        ? await orderApi<Post>(`/me/posts/${d.id}`, "PUT", d)
        : await orderApi<Post>("/me/posts", "POST", d);
      if (submit) p = await orderApi<Post>(`/me/posts/${p.id}/submit`, "POST");
      upsert(p);
      setD(null);
      toast({ tone: "success", title: submit ? "Sent for review" : "Draft saved" });
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Card>
      <DataTable
        rows={rows}
        rowKey={(p) => p.id}
        empty={{
          title: "No posts yet",
          body: "Share study tips; an EduKhata editor reviews each post.",
        }}
        toolbar={
          <Button
            size="sm"
            variant="accent"
            onClick={() => setD({ title: "", excerpt: "", body: "", category: "study-tips" })}
          >
            New post
          </Button>
        }
        onRowClick={(p) => ["draft", "rejected"].includes(p.status) && setD({ ...p })}
        columns={[
          { key: "t", header: "Title", cell: (p) => <b>{p.title}</b> },
          { key: "u", header: "Updated", cell: (p) => formatDate(p.updatedAt, lang) },
          {
            key: "s",
            header: "Status",
            cell: (p) => (
              <span className="inline-flex flex-col items-start">
                <Badge tone={P_STATUS[p.status][1]}>{P_STATUS[p.status][0]}</Badge>
                {p.status === "rejected" && p.reviewNote && (
                  <span className="text-[11px] text-muted">{p.reviewNote}</span>
                )}
              </span>
            ),
          },
        ]}
      />
      <Modal
        open={!!d}
        onClose={() => setD(null)}
        title={d?.id ? "Edit post" : "New post"}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => save(false)}>
              Save draft
            </Button>
            <Button variant="accent" onClick={() => save(true)}>
              Send for review
            </Button>
          </>
        }
      >
        {d && <PostForm d={d} set={setD} />}
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}
      </Modal>
    </Card>
  );
}

/** Renders post text as text (never HTML): paragraphs, "## " headings, "- " lists. */
export function PostText({ body }: { body: string }) {
  return (
    <div className="space-y-3 leading-relaxed">
      {body.split(/\n\s*\n/).map((block, i) => {
        const lines = block.split("\n");
        if (block.startsWith("## "))
          return (
            <h2 key={i} className="pt-2 text-lg font-bold">
              {block.slice(3)}
            </h2>
          );
        if (lines.every((l) => l.startsWith("- ")))
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{l.slice(2)}</li>
              ))}
            </ul>
          );
        return <p key={i}>{block}</p>;
      })}
    </div>
  );
}
