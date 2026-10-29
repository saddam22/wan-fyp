"use client";

import { useState } from "react";
import { FileCheck2, Upload } from "lucide-react";
import { fixtures } from "@edukhata/contracts";
import { Field } from "@/components/ui";
import { useDemoToast } from "@/components/ui/client";
import { cn } from "@/lib/cn";

const DOCS = [
  ["nid", "National ID or passport", true],
  ["certificate", "Highest certificate", true],
  ["transcript", "Transcript / marksheet", false],
  ["sample", "Handwriting or drawing sample", true],
] as const;

export function MentorApplicationForm() {
  const demo = useDemoToast();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [f, setF] = useState({
    education: "",
    institution: "",
    experience: "",
    bio: "",
    payout: "bkash",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const er: Record<string, string> = {};
        if (subjects.length === 0) er.subjects = "Choose at least one subject";
        if (f.education.trim().length < 3) er.education = "Enter your highest degree";
        if (f.institution.trim().length < 3) er.institution = "Enter your institution";
        if (f.bio.trim().length < 50)
          er.bio = "Write at least 50 characters about your teaching and work";
        for (const [k, label, req] of DOCS) if (req && !docs[k]) er[k] = `${label} is required`;
        setErrors(er);
        if (Object.keys(er).length) return;
        demo("Application submitted for review");
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Subjects you can teach <span className="text-danger">*</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {fixtures.subjects.map((s) => {
            const on = subjects.includes(s.id);
            return (
              <button
                type="button"
                key={s.id}
                aria-pressed={on}
                onClick={() =>
                  setSubjects(on ? subjects.filter((x) => x !== s.id) : [...subjects, s.id])
                }
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
                  on
                    ? "bg-success text-white ring-success"
                    : "bg-white ring-line hover:bg-slate-50",
                )}
              >
                {s.name}
              </button>
            );
          })}
        </div>
        {errors.subjects && <p className="mt-1 text-xs text-danger">{errors.subjects}</p>}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Highest degree" required htmlFor="m-ed" error={errors.education}>
          <input
            id="m-ed"
            className="input"
            aria-invalid={!!errors.education}
            value={f.education}
            onChange={(e) => setF({ ...f, education: e.target.value })}
            placeholder="e.g. MSc, Chemistry"
          />
        </Field>
        <Field label="Institution" required htmlFor="m-in" error={errors.institution}>
          <input
            id="m-in"
            className="input"
            aria-invalid={!!errors.institution}
            value={f.institution}
            onChange={(e) => setF({ ...f, institution: e.target.value })}
          />
        </Field>
        <Field label="Teaching experience (years)" htmlFor="m-ex">
          <input
            id="m-ex"
            type="number"
            min={0}
            max={60}
            className="input"
            value={f.experience}
            onChange={(e) => setF({ ...f, experience: e.target.value })}
          />
        </Field>
        <Field label="Preferred payout method" htmlFor="m-po">
          <select
            id="m-po"
            className="input"
            value={f.payout}
            onChange={(e) => setF({ ...f, payout: e.target.value })}
          >
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
            <option value="bank">Bank account</option>
          </select>
        </Field>
      </div>
      <Field
        label="About you"
        required
        htmlFor="m-bio"
        error={errors.bio}
        hint="Shown on your public profile after approval."
      >
        <textarea
          id="m-bio"
          rows={4}
          className="input"
          aria-invalid={!!errors.bio}
          value={f.bio}
          onChange={(e) => setF({ ...f, bio: e.target.value })}
          maxLength={1500}
        />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Documents</legend>
        <p className="mb-2 text-xs text-muted">
          Stored privately and seen only by the verification team. Documents are reviewed by a
          person — never auto-approved.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {DOCS.map(([k, label, req]) => (
            <li key={k}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-3 text-sm",
                  docs[k]
                    ? "border-success bg-success-50"
                    : errors[k]
                      ? "border-danger"
                      : "border-line",
                )}
              >
                {docs[k] ? (
                  <FileCheck2 size={18} className="text-success" />
                ) : (
                  <Upload size={18} className="text-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {label}
                    {req && <span className="text-danger"> *</span>}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    {docs[k] ?? "PDF, JPG or PNG · max 8 MB"}
                  </span>
                </span>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setDocs({ ...docs, [k]: file.name });
                  }}
                />
              </label>
              {errors[k] && <p className="mt-1 text-xs text-danger">{errors[k]}</p>}
            </li>
          ))}
        </ul>
      </fieldset>
      <button className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-success px-6 text-sm font-semibold text-white hover:brightness-95">
        Submit application
      </button>
    </form>
  );
}
