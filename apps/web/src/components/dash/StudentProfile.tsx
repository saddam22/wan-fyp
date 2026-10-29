"use client";

import { useState } from "react";
import { ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { fixtures } from "@edukhata/contracts";
import { Avatar, Button, Card, CardHeader, Field, Progress } from "@/components/ui";
import { CopyButton, useDemoToast } from "@/components/ui/client";
import { cn } from "@/lib/cn";
import { WAN_HUB_URL } from "@/lib/site";

/** `guardianLinks` replaces the demo guardian card when signed in with WAN ID. */
export function StudentProfile({ guardianLinks }: { guardianLinks?: React.ReactNode }) {
  const me = fixtures.me;
  const demo = useDemoToast();
  const [f, setF] = useState({
    institution: me.institution,
    classLevel: me.classLevel,
    board: me.board,
    subjects: me.subjects,
    showOnLeaderboard: true,
  });
  const [code, setCode] = useState<string | null>(null);
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader
          title="Marketplace profile"
          sub="Name, email, phone and password are managed in your WAN ID."
        />
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => (e.preventDefault(), demo("Profile saved"))}
        >
          <div className="flex items-center gap-4">
            <Avatar name={me.name} hue={me.hue} size={64} />
            <div className="text-sm">
              <p className="font-bold">{me.name}</p>
              <p className="text-muted">
                {me.email} · {me.phone}
              </p>
              <p className="text-xs text-muted">{me.wanId}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Institution" htmlFor="p-in">
              <input
                id="p-in"
                className="input"
                value={f.institution}
                onChange={(e) => setF({ ...f, institution: e.target.value })}
              />
            </Field>
            <Field label="Class / year" htmlFor="p-cl">
              <input
                id="p-cl"
                className="input"
                value={f.classLevel}
                onChange={(e) => setF({ ...f, classLevel: e.target.value })}
              />
            </Field>
            <Field label="Board" htmlFor="p-bd">
              <input
                id="p-bd"
                className="input"
                value={f.board}
                onChange={(e) => setF({ ...f, board: e.target.value })}
              />
            </Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Subjects</legend>
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
                      "rounded-full px-3 py-1 text-xs font-semibold ring-1",
                      on
                        ? "bg-[var(--color-accent)] text-white ring-[var(--color-accent)]"
                        : "ring-line",
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.showOnLeaderboard}
              onChange={(e) => setF({ ...f, showOnLeaderboard: e.target.checked })}
              className="accent-[var(--color-accent)]"
            />{" "}
            Show me on the public student leaderboard
          </label>
          <Button type="submit" variant="accent">
            Save changes
          </Button>
        </form>
      </Card>
      <div className="space-y-5">
        <Card className="p-5">
          <p className="mb-1 text-sm font-bold">Profile completion</p>
          <Progress value={me.profileCompletion} tone="accent" />
          <p className="mt-1 text-xs text-muted">
            {me.profileCompletion}% — add a profile photo in WAN ID to reach 100%.
          </p>
        </Card>
        {guardianLinks ?? (
          <Card className="p-5">
            <p className="flex items-center gap-2 text-sm font-bold">
              <KeyRound size={16} /> Link a guardian
            </p>
            <p className="mt-1 text-xs text-muted">
              Create a one-time code and give it to your parent or guardian. You decide what they
              can see in their dashboard.
            </p>
            {code ? (
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-lg bg-slate-50 px-3 py-2 font-mono font-bold tracking-widest">
                  {code}
                </span>
                <CopyButton text={code} />
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setCode(Math.random().toString(36).slice(2, 10).toUpperCase())}
              >
                Generate link code
              </Button>
            )}
            <p className="mt-2 text-[11px] text-muted">
              Linked: Shirin Akter (orders ✓, payments ✓, pay on behalf ✓)
            </p>
          </Card>
        )}
        <Card className="space-y-2 p-5 text-sm">
          <p className="flex items-center gap-2 font-bold">
            <ShieldCheck size={16} /> Account & security
          </p>
          <p className="text-xs text-muted">
            Password, two-factor authentication, sessions and login history are managed in WAN
            Identity Hub.
          </p>
          <a
            href={`${WAN_HUB_URL}/#/security`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline"
          >
            Open WAN ID security <ExternalLink size={12} />
          </a>
        </Card>
      </div>
    </div>
  );
}
