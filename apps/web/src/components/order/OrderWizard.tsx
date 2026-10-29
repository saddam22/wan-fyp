"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  Check,
  FileUp,
  Info,
  Sparkles,
  Trash2,
  Truck,
  Upload,
  Wand2,
} from "lucide-react";
import {
  bdt,
  fixtures,
  formatMoney,
  mockApi,
  splitCommission,
  type Level,
  type WorkType,
} from "@edukhata/contracts";
import { Avatar, Button, Card, Field } from "@/components/ui";
import { useToast } from "@/components/ui/client";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { LEVEL, WORK_TYPE } from "@/lib/labels";
import { orderApi, uploadOrderFile } from "@/lib/order-api";

/** What the live wizard needs from the API (GET /catalog, GET /mentors). */
export interface WizardCatalog {
  subjects: { id: string; name: string; nameBn: string; levels: Level[] }[];
  categories: { slug: string; name: string; nameBn: string; description: string }[];
  priceList: Record<WorkType, { amountMinor: number; currency: string }>;
  rules: { freeRevisions: number; courierFeeMinor: number; minDeadlineHours: number };
  mentors: {
    id: string;
    name: string;
    subjects: string[];
    available: boolean;
    rating: number | null;
  }[];
}

/** Indicative per-page prices (BDT). The real price list comes from admin settings in Phase 4. */
const PER_PAGE: Record<WorkType, number> = {
  digital: 70,
  handwritten: 50,
  practical_khata: 50,
  biology_drawing: 250,
  pencil_sketch: 300,
  diagram: 160,
};
const ALLOWED = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_MB = 10;

interface Draft {
  category: string;
  workType: WorkType;
  level: Level;
  subject: string;
  title: string;
  instructions: string;
  pages: number;
  files: { name: string; sizeKb: number }[];
  deadline: string;
  delivery: "digital" | "courier";
  address: string;
  mentor: string;
  coupon: string;
  agree: boolean;
}

const STEPS = ["Type & subject", "Requirements", "Deadline & delivery", "Review & pay"];

function minDeadline(hours = 24) {
  const d = new Date(Date.now() + hours * 3600_000);
  d.setMinutes(0, 0, 0);
  return d;
}
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `live`: real catalog, prices, mentors and order creation through the API. */
export function OrderWizard({ live }: { live?: WizardCatalog } = {}) {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { t, lang } = useT();
  const chosen = !live && params.get("mentor") ? mockApi.mentor(params.get("mentor")!) : undefined;
  const liveChosen = live?.mentors.find((m) => m.id === params.get("mentor"));
  const categories = live?.categories ?? fixtures.categories;
  const subjects = live?.subjects ?? fixtures.subjects;
  const [fileObjs, setFileObjs] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [d, setD] = useState<Draft>({
    category: params.get("category") ?? "",
    workType: "practical_khata",
    level: "hsc",
    subject: chosen?.primarySubject ?? liveChosen?.subjects[0] ?? params.get("subject") ?? "",
    title: "",
    instructions: "",
    pages: 10,
    files: [],
    deadline: "",
    delivery: "digital",
    address: "",
    mentor: chosen?.handle ?? liveChosen?.id ?? "auto",
    coupon: "",
    agree: false,
  });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const price = useMemo(() => {
    // Live: the API's price list (the server computes the final price the same way).
    const perPage = live ? live.priceList[d.workType].amountMinor / 100 : PER_PAGE[d.workType];
    const base = perPage * d.pages;
    const courier = d.delivery === "courier" ? (live ? live.rules.courierFeeMinor / 100 : 120) : 0;
    const discount =
      !live && d.coupon.trim().toUpperCase() === "WELCOME20" ? Math.round(base * 0.2) : 0;
    const total = base + courier - discount;
    return { base, courier, discount, total, split: splitCommission(Math.round(total * 100), 0.2) };
  }, [d.workType, d.pages, d.delivery, d.coupon, live]);

  function validate(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!d.category) e.category = "Choose a category";
      if (!d.subject) e.subject = "Choose a subject";
    }
    if (s === 1) {
      if (d.title.trim().length < 8) e.title = "Write a short title (at least 8 characters)";
      if (d.instructions.trim().length < 30)
        e.instructions = "Describe what you need (at least 30 characters) — board, chapter, format";
      if (!(d.pages >= 1 && d.pages <= 300)) e.pages = "Pages must be between 1 and 300";
    }
    if (s === 2) {
      if (!d.deadline) e.deadline = "Choose a deadline";
      else if (new Date(d.deadline) < minDeadline(live?.rules.minDeadlineHours))
        e.deadline = `Deadline must be at least ${live?.rules.minDeadlineHours ?? 24} hours from now`;
      if (d.delivery === "courier" && d.address.trim().length < 10)
        e.address = "Enter the full delivery address";
    }
    if (s === 3 && !d.agree) e.agree = "Please accept the terms and academic-integrity policy";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...d.files];
    for (const f of Array.from(list)) {
      if (!ALLOWED.includes(f.type)) {
        toast({
          tone: "danger",
          title: `${f.name}: file type not allowed`,
          body: "Use PDF, JPG, PNG, WEBP or Word.",
        });
        continue;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        toast({ tone: "danger", title: `${f.name} is larger than ${MAX_MB} MB` });
        continue;
      }
      if (next.length >= 8) {
        toast({ tone: "warning", title: "Up to 8 files per order" });
        break;
      }
      next.push({ name: f.name, sizeKb: Math.round(f.size / 1024) });
      setFileObjs((xs) => [...xs, f]);
    }
    set("files", next);
  }

  const mentors = live
    ? live.mentors
        .filter((m) => !d.subject || m.subjects.includes(d.subject))
        .map((m) => ({
          id: m.id,
          handle: m.id,
          name: m.name,
          hue: m.name.length * 23,
          verified: false,
          rating: m.rating ?? "new",
          available: m.available,
        }))
    : mockApi.mentors({ subject: d.subject || undefined });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="min-w-0">
        <ol className="flex border-b border-line" aria-label="Steps">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1">
              <button
                type="button"
                disabled={i > step}
                onClick={() => i < step && setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "flex w-full flex-col items-center gap-1 px-1 py-3 text-[11px] font-semibold sm:flex-row sm:justify-center sm:gap-2 sm:text-xs",
                  i === step ? "text-brand-600" : i < step ? "text-success" : "text-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px]",
                    i === step
                      ? "bg-brand-600 text-white"
                      : i < step
                        ? "bg-success text-white"
                        : "bg-slate-100",
                  )}
                >
                  {i < step ? <Check size={13} /> : i + 1}
                </span>
                <span className="text-center">{label}</span>
              </button>
            </li>
          ))}
        </ol>

        <form
          noValidate
          className="space-y-5 p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!validate(step)) return;
            if (step < 3) return setStep(step + 1);
            if (live) {
              setSubmitting(true);
              try {
                const o = await orderApi<{ id: string; code: string }>("/orders", "POST", {
                  categorySlug: d.category,
                  subjectId: d.subject,
                  level: d.level,
                  workType: d.workType,
                  pages: d.pages,
                  title: d.title,
                  instructions: d.instructions,
                  deadline: new Date(d.deadline).toISOString(),
                  deliveryMethod: d.delivery,
                  ...(d.delivery === "courier" ? { deliveryAddress: d.address } : {}),
                  ...(d.mentor !== "auto" ? { preferredMentorId: d.mentor } : {}),
                });
                for (const f of fileObjs) await uploadOrderFile(o.id, "requirement", f);
                toast({ tone: "success", title: `Order ${o.code} placed`, body: "Next: payment." });
                router.push(`/student/orders/${o.id}`);
              } catch (err) {
                toast({ tone: "danger", title: "Order not placed", body: (err as Error).message });
                setSubmitting(false);
              }
              return;
            }
            toast({
              tone: "success",
              title: "Order EK-24540 created (demo)",
              body: "Next: pay and submit your transaction ID. Nothing was saved — backend arrives in Phase 4.",
            });
            router.push("/student/payments/p1/pay");
          }}
        >
          {step === 0 && (
            <>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">
                  Category <span className="text-danger">*</span>
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {categories.map((c) => (
                    <label
                      key={c.slug}
                      className={cn(
                        "cursor-pointer rounded-xl border p-3 text-sm transition",
                        d.category === c.slug
                          ? "border-brand-600 bg-brand-50 ring-2 ring-brand-600/20"
                          : "border-line hover:border-brand-600/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="category"
                        value={c.slug}
                        checked={d.category === c.slug}
                        onChange={() => set("category", c.slug)}
                        className="sr-only"
                      />
                      <span className="block font-semibold">
                        {lang === "bn" ? c.nameBn : c.name}
                      </span>
                      <span className="text-[11px] text-muted">{c.description}</span>
                    </label>
                  ))}
                </div>
                {errors.category && <p className="mt-1 text-xs text-danger">{errors.category}</p>}
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Type of work" required htmlFor="wt">
                  <select
                    id="wt"
                    className="input"
                    value={d.workType}
                    onChange={(e) => set("workType", e.target.value as WorkType)}
                  >
                    {Object.entries(WORK_TYPE).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Level" required htmlFor="lv">
                  <select
                    id="lv"
                    className="input"
                    value={d.level}
                    onChange={(e) => set("level", e.target.value as Level)}
                  >
                    {Object.entries(LEVEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Subject" required htmlFor="sj" error={errors.subject}>
                  <select
                    id="sj"
                    className="input"
                    aria-invalid={!!errors.subject}
                    value={d.subject}
                    onChange={(e) => set("subject", e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {subjects
                      .filter((s) => s.levels.length === 0 || s.levels.includes(d.level))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {lang === "bn" ? s.nameBn : s.name}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <Field
                label="Title"
                required
                htmlFor="title"
                error={errors.title}
                hint="e.g. Biology Practical Khata — Class 12 (Plant & Animal)"
              >
                <input
                  id="title"
                  className="input"
                  aria-invalid={!!errors.title}
                  value={d.title}
                  onChange={(e) => set("title", e.target.value)}
                  maxLength={120}
                />
              </Field>
              <Field
                label="Instructions"
                required
                htmlFor="ins"
                error={errors.instructions}
                hint="Board / university, chapter, format, ink colour, diagram list, anything your teacher asked for."
              >
                <textarea
                  id="ins"
                  rows={6}
                  className="input"
                  aria-invalid={!!errors.instructions}
                  value={d.instructions}
                  onChange={(e) => set("instructions", e.target.value)}
                  maxLength={4000}
                />
              </Field>
              <Field label="Pages / quantity" required htmlFor="pg" error={errors.pages}>
                <input
                  id="pg"
                  type="number"
                  min={1}
                  max={300}
                  className="input sm:w-40"
                  aria-invalid={!!errors.pages}
                  value={d.pages}
                  onChange={(e) => set("pages", Number(e.target.value))}
                />
              </Field>
              <div>
                <p className="mb-1.5 text-sm font-medium">Requirement files</p>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => (e.preventDefault(), addFiles(e.dataTransfer.files))}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-slate-50 px-4 py-6 text-center"
                >
                  <Upload size={24} className="text-brand-600" />
                  <p className="text-sm">
                    Drag & drop or{" "}
                    <button
                      type="button"
                      className="font-semibold text-brand-600 underline"
                      onClick={() => fileRef.current?.click()}
                    >
                      browse
                    </button>
                  </p>
                  <p className="text-[11px] text-muted">
                    PDF, JPG, PNG, WEBP, DOC/DOCX · max {MAX_MB} MB each · up to 8 files. Files are
                    private to you, your mentor and support.
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept={ALLOWED.join(",")}
                    className="sr-only"
                    onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))}
                  />
                </div>
                {d.files.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {d.files.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm"
                      >
                        <FileUp size={15} className="text-muted" />
                        <span className="min-w-0 flex-1 truncate">{f.name}</span>
                        <span className="text-xs text-muted">{f.sizeKb} KB</span>
                        <button
                          type="button"
                          aria-label={`Remove ${f.name}`}
                          onClick={() => (
                            set(
                              "files",
                              d.files.filter((_, j) => j !== i),
                            ),
                            setFileObjs((xs) => xs.filter((_, j) => j !== i))
                          )}
                          className="text-muted hover:text-danger"
                        >
                          <Trash2 size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Field
                label="Deadline"
                required
                htmlFor="dl"
                error={errors.deadline}
                hint="At least 24 hours from now. Leave time for a revision before your submission date."
              >
                <input
                  id="dl"
                  type="datetime-local"
                  className="input sm:w-64"
                  aria-invalid={!!errors.deadline}
                  min={toLocalInput(minDeadline())}
                  value={d.deadline}
                  onChange={(e) => set("deadline", e.target.value)}
                />
              </Field>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Delivery</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      [
                        "digital",
                        "Digital (PDF / scan)",
                        "Download from your order page",
                        CalendarClock,
                      ],
                      [
                        "courier",
                        "Courier (handwritten original)",
                        "Scanned preview first, then courier (+৳120)",
                        Truck,
                      ],
                    ] as const
                  ).map(([v, title, sub, Icon]) => (
                    <label
                      key={v}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                        d.delivery === v ? "border-brand-600 bg-brand-50" : "border-line",
                      )}
                    >
                      <input
                        type="radio"
                        name="delivery"
                        checked={d.delivery === v}
                        onChange={() => set("delivery", v)}
                        className="mt-1 accent-brand-600"
                      />
                      <Icon size={18} className="mt-0.5 text-brand-600" />
                      <span>
                        <span className="block text-sm font-semibold">{title}</span>
                        <span className="text-[11px] text-muted">{sub}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {d.delivery === "courier" && (
                <Field label="Delivery address" required htmlFor="addr" error={errors.address}>
                  <textarea
                    id="addr"
                    rows={2}
                    className="input"
                    aria-invalid={!!errors.address}
                    value={d.address}
                    onChange={(e) => set("address", e.target.value)}
                  />
                </Field>
              )}
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Mentor</legend>
                <label
                  className={cn(
                    "mb-2 flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                    d.mentor === "auto" ? "border-brand-600 bg-brand-50" : "border-line",
                  )}
                >
                  <input
                    type="radio"
                    name="mentor"
                    checked={d.mentor === "auto"}
                    onChange={() => set("mentor", "auto")}
                    className="mt-1 accent-brand-600"
                  />
                  <Wand2 size={18} className="mt-0.5 text-brand-600" />
                  <span>
                    <span className="block text-sm font-semibold">
                      Match me automatically (recommended)
                    </span>
                    <span className="text-[11px] text-muted">
                      Offered to available mentors with the right subject skills; the first to
                      accept gets it.
                    </span>
                  </span>
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {mentors.slice(0, 4).map((m) => (
                    <label
                      key={m.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border p-3",
                        d.mentor === m.handle ? "border-brand-600 bg-brand-50" : "border-line",
                      )}
                    >
                      <input
                        type="radio"
                        name="mentor"
                        checked={d.mentor === m.handle}
                        onChange={() => set("mentor", m.handle)}
                        className="accent-brand-600"
                      />
                      <Avatar name={m.name} hue={m.hue} size={32} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 truncate text-sm font-semibold">
                          {m.name}{" "}
                          {m.verified && (
                            <BadgeCheck size={13} className="fill-brand-600 text-white" />
                          )}
                        </span>
                        <span className="text-[11px] text-muted">
                          ★ {m.rating} · {m.available ? "Available" : "Fully booked"}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {step === 3 && (
            <>
              <div className="rounded-xl bg-slate-50 p-4 text-sm">
                <p className="font-semibold">{d.title}</p>
                <p className="mt-1 text-xs text-muted">
                  {categories.find((c) => c.slug === d.category)?.name} · {WORK_TYPE[d.workType]} ·{" "}
                  {LEVEL[d.level]} · {subjects.find((s) => s.id === d.subject)?.name} · {d.pages}{" "}
                  pages · {d.files.length} file(s)
                </p>
                <p className="mt-1 text-xs text-muted">
                  Deadline {d.deadline && new Date(d.deadline).toLocaleString()} ·{" "}
                  {d.delivery === "courier" ? "Courier" : "Digital"} ·{" "}
                  {d.mentor === "auto"
                    ? "Auto-match"
                    : (mentors.find((m) => m.handle === d.mentor)?.name ??
                      mockApi.mentor(d.mentor)?.name)}
                </p>
              </div>
              {!live && (
                <Field label="Coupon code" htmlFor="cp" hint="Try WELCOME20 (first order)">
                  <input
                    id="cp"
                    className="input font-mono uppercase sm:w-48"
                    value={d.coupon}
                    onChange={(e) => set("coupon", e.target.value)}
                  />
                </Field>
              )}
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={d.agree}
                  onChange={(e) => set("agree", e.target.checked)}
                  className="mt-1 accent-brand-600"
                />
                <span>
                  I agree to the{" "}
                  <a href="/terms" className="text-brand-600 underline" target="_blank">
                    Terms
                  </a>
                  ,{" "}
                  <a href="/refund-policy" className="text-brand-600 underline" target="_blank">
                    Refund Policy
                  </a>{" "}
                  and will follow my institution&apos;s academic-integrity rules when using
                  delivered work.
                </span>
              </label>
              {errors.agree && <p className="-mt-3 text-xs text-danger">{errors.agree}</p>}
            </>
          )}

          <div className="flex items-center justify-between border-t border-line pt-4">
            <Button
              variant="outline"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              {t.common.back}
            </Button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand disabled:opacity-50"
            >
              {step < 3
                ? t.common.next
                : live
                  ? `Place order · ${formatMoney(bdt(price.total), lang)}`
                  : `Place order & pay ${formatMoney(bdt(price.total), lang)}`}
            </button>
          </div>
        </form>
      </Card>

      <aside className="space-y-4 lg:sticky lg:top-32 lg:h-fit">
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            <Sparkles size={16} className="text-amber-500" /> Price estimate
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">
                {WORK_TYPE[d.workType]} × {d.pages}
              </dt>
              <dd>{formatMoney(bdt(price.base), lang)}</dd>
            </div>
            {price.courier > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Courier</dt>
                <dd>{formatMoney(bdt(price.courier), lang)}</dd>
              </div>
            )}
            {price.discount > 0 && (
              <div className="flex justify-between text-success">
                <dt>WELCOME20</dt>
                <dd>−{formatMoney(bdt(price.discount), lang)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatMoney(bdt(price.total), lang)}</dd>
            </div>
          </dl>
          <ul className="mt-4 space-y-1.5 text-xs text-muted">
            <li>✓ {live?.rules.freeRevisions ?? 2} free revisions included</li>
            <li>✓ Mentor receives 80% only after you approve</li>
            <li>✓ Full refund if no mentor accepts</li>
          </ul>
        </Card>
        <p className="flex gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-900">
          <Info size={16} className="shrink-0" />{" "}
          {live
            ? "Prices come from EduKhata's price list; the server confirms the total when you place the order."
            : "Indicative prices. The final price list and coupon rules are configured by admins (Phase 4–5)."}
        </p>
      </aside>
    </div>
  );
}
