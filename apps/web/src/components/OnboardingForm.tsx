"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GraduationCap, UserPlus, Users } from "lucide-react";
import { fixtures } from "@edukhata/contracts";
import { Field, Progress } from "@/components/ui";
import { useDemoToast } from "@/components/ui/client";
import { cn } from "@/lib/cn";

type Kind = "student" | "guardian" | "mentor";

export function OnboardingForm() {
  const [kind, setKind] = useState<Kind>("student");
  const [f, setF] = useState({
    institution: "",
    classLevel: "",
    board: "Dhaka",
    subjects: [] as string[],
    childCode: "",
    country: "BD",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const demo = useDemoToast();
  const router = useRouter();
  const filled =
    kind === "student"
      ? [f.institution, f.classLevel, f.subjects.length ? "x" : ""].filter(Boolean).length / 3
      : kind === "guardian"
        ? f.childCode
          ? 1
          : 0.5
        : 0.3;
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (kind === "mentor") return router.push("/become-a-mentor");
        const er: Record<string, string> = {};
        if (kind === "student") {
          if (f.institution.trim().length < 3)
            er.institution = "Enter your school, college or university";
          if (!f.classLevel) er.classLevel = "Choose your class";
          if (f.subjects.length === 0) er.subjects = "Choose at least one subject";
        }
        if (
          kind === "guardian" &&
          f.childCode &&
          !/^[A-Z0-9]{6,10}$/.test(f.childCode.toUpperCase())
        )
          er.childCode = "Link codes are 6–10 letters/numbers";
        setErrors(er);
        if (Object.keys(er).length === 0) demo("Profile completed");
      }}
    >
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>Profile completion</span>
          <span>{Math.round(filled * 100)}%</span>
        </div>
        <Progress value={filled * 100} />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">I am a…</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["student", "Student", "Order assignments", GraduationCap],
              ["guardian", "Parent / guardian", "Follow my child's orders", Users],
              ["mentor", "Mentor", "Apply to teach & earn", UserPlus],
            ] as const
          ).map(([k, t, s, Icon]) => (
            <label
              key={k}
              className={cn(
                "cursor-pointer rounded-xl border p-3 text-center",
                kind === k
                  ? "border-brand-600 bg-brand-50 ring-2 ring-brand-600/20"
                  : "border-line",
              )}
            >
              <input
                type="radio"
                name="kind"
                className="sr-only"
                checked={kind === k}
                onChange={() => setKind(k)}
              />
              <Icon size={22} className="mx-auto text-brand-600" />
              <span className="mt-1 block text-sm font-bold">{t}</span>
              <span className="block text-[11px] text-muted">{s}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {kind === "student" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Institution" required htmlFor="o-in" error={errors.institution}>
              <input
                id="o-in"
                className="input"
                aria-invalid={!!errors.institution}
                value={f.institution}
                onChange={(e) => setF({ ...f, institution: e.target.value })}
              />
            </Field>
            <Field label="Class / year" required htmlFor="o-cl" error={errors.classLevel}>
              <select
                id="o-cl"
                className="input"
                aria-invalid={!!errors.classLevel}
                value={f.classLevel}
                onChange={(e) => setF({ ...f, classLevel: e.target.value })}
              >
                <option value="">Choose…</option>
                {[
                  "Class 6–8",
                  "Class 9 (SSC)",
                  "Class 10 (SSC)",
                  "HSC 1st year",
                  "HSC 2nd year",
                  "Diploma / Polytechnic",
                  "University (Undergraduate)",
                  "University (Postgraduate)",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Education board" htmlFor="o-bd">
              <select
                id="o-bd"
                className="input"
                value={f.board}
                onChange={(e) => setF({ ...f, board: e.target.value })}
              >
                {[
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
                  "Not applicable",
                ].map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Country"
              htmlFor="o-co"
              hint="Bangladesh at launch; more countries later."
            >
              <select
                id="o-co"
                className="input"
                value={f.country}
                onChange={(e) => setF({ ...f, country: e.target.value })}
              >
                <option value="BD">Bangladesh (+880)</option>
                <option value="other" disabled>
                  Other countries — coming soon
                </option>
              </select>
            </Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              Subjects <span className="text-danger">*</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {fixtures.subjects.map((s) => {
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
                      "rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
                      on ? "bg-brand-600 text-white ring-brand-600" : "ring-line",
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
            {errors.subjects && <p className="mt-1 text-xs text-danger">{errors.subjects}</p>}
          </fieldset>
        </>
      )}
      {kind === "guardian" && (
        <Field
          label="Child's link code (optional now)"
          htmlFor="o-code"
          error={errors.childCode}
          hint="Your child creates a one-time code in their Student dashboard → Profile. You can link later too."
        >
          <input
            id="o-code"
            className="input font-mono uppercase sm:w-56"
            aria-invalid={!!errors.childCode}
            value={f.childCode}
            onChange={(e) => setF({ ...f, childCode: e.target.value })}
          />
        </Field>
      )}
      {kind === "mentor" && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900">
          Mentors apply with documents and a skill test. An EduKhata admin grants the mentor role
          after review.
        </p>
      )}
      <button className="inline-flex h-11 items-center rounded-[10px] bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand">
        {kind === "mentor" ? "Continue to application" : "Finish setup"}
      </button>
    </form>
  );
}
