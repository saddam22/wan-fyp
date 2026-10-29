"use client";

import { useState } from "react";
import type { Level, WorkType } from "@edukhata/contracts";
import { Button, Card, CardHeader, Field } from "@/components/ui";
import { useToast } from "@/components/ui/client";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { LEVEL, WORK_TYPE } from "@/lib/labels";
import { orderApi } from "@/lib/order-api";

/** GET/PUT /api/mentor/profile */
export interface LiveMentorProfile {
  headline: string;
  bio: string;
  institution: string;
  education: string;
  subjects: string[];
  workTypes: WorkType[];
  levels: Level[];
  available: boolean;
  capacity: number;
  activeOrders: number;
  completedOrders: number;
}

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  label: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value.includes(o.id)}
            onClick={() => onChange(toggle(value, o.id))}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold",
              value.includes(o.id)
                ? "border-[var(--color-accent)] bg-[var(--color-accent-50)] text-[var(--color-accent)]"
                : "border-line text-slate-600",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** What matching uses: subjects, types of work, levels, availability and capacity. */
export function MentorProfileForm({
  profile,
  subjects,
}: {
  profile: LiveMentorProfile;
  subjects: { id: string; name: string; nameBn: string }[];
}) {
  const { lang } = useT();
  const toast = useToast();
  const [p, setP] = useState(profile);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof LiveMentorProfile>(k: K, v: LiveMentorProfile[K]) =>
    setP((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      const saved = await orderApi<LiveMentorProfile>("/mentor/profile", "PUT", {
        headline: p.headline,
        bio: p.bio,
        institution: p.institution,
        education: p.education,
        subjects: p.subjects,
        workTypes: p.workTypes,
        levels: p.levels,
        available: p.available,
        capacity: p.capacity,
      });
      setP(saved);
      toast({ tone: "success", title: "Profile saved" });
    } catch (e) {
      toast({ tone: "danger", title: "Not saved", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Profile & matching"
        sub={`${p.activeOrders} active · ${p.completedOrders} completed orders`}
      />
      <form className="space-y-5 p-5" onSubmit={(e) => (e.preventDefault(), void save())}>
        <label className="flex items-center gap-3 rounded-lg border border-line p-3 text-sm">
          <input
            type="checkbox"
            data-testid="mentor-available"
            checked={p.available}
            onChange={(e) => set("available", e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          <span>
            <span className="block font-semibold">Taking new orders</span>
            <span className="text-xs text-muted">
              Matching offers you orders only while this is on.
            </span>
          </span>
        </label>
        <Chips
          label="Subjects"
          options={subjects.map((s) => ({ id: s.id, label: lang === "bn" ? s.nameBn : s.name }))}
          value={p.subjects}
          onChange={(v) => set("subjects", v)}
        />
        <Chips
          label="Types of work"
          options={(Object.keys(WORK_TYPE) as WorkType[]).map((k) => ({
            id: k,
            label: WORK_TYPE[k],
          }))}
          value={p.workTypes}
          onChange={(v) => set("workTypes", v)}
        />
        <Chips
          label="Levels (none = all)"
          options={(Object.keys(LEVEL) as Level[]).map((k) => ({ id: k, label: LEVEL[k] }))}
          value={p.levels}
          onChange={(v) => set("levels", v)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Orders at a time" htmlFor="mp-cap">
            <input
              id="mp-cap"
              type="number"
              min={1}
              max={20}
              className="input"
              value={p.capacity}
              onChange={(e) => set("capacity", Number(e.target.value))}
            />
          </Field>
          <Field label="Headline" htmlFor="mp-h">
            <input
              id="mp-h"
              className="input"
              maxLength={120}
              value={p.headline}
              onChange={(e) => set("headline", e.target.value)}
            />
          </Field>
          <Field label="Education" htmlFor="mp-e">
            <input
              id="mp-e"
              className="input"
              maxLength={200}
              value={p.education}
              onChange={(e) => set("education", e.target.value)}
            />
          </Field>
          <Field label="Institution" htmlFor="mp-i">
            <input
              id="mp-i"
              className="input"
              maxLength={120}
              value={p.institution}
              onChange={(e) => set("institution", e.target.value)}
            />
          </Field>
        </div>
        <Field label="About" htmlFor="mp-b">
          <textarea
            id="mp-b"
            rows={4}
            className="input"
            maxLength={2000}
            value={p.bio}
            onChange={(e) => set("bio", e.target.value)}
          />
        </Field>
        <Button type="submit" variant="accent" disabled={busy}>
          Save profile
        </Button>
      </form>
    </Card>
  );
}
