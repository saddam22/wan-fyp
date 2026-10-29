"use client";

import { useState } from "react";
import { KeyRound, Link2, ShieldCheck, Unlink } from "lucide-react";
import { formatDate } from "@edukhata/contracts";
import { Avatar, Button, Card, CardHeader, EmptyState, Field } from "@/components/ui";
import { CopyButton, Modal, useToast } from "@/components/ui/client";
import { useT } from "@/lib/i18n/client";

export interface Permissions {
  viewOrders: boolean;
  viewPayments: boolean;
  payOnBehalf: boolean;
}

/** GET /api/guardian/children */
export interface LiveChild {
  studentId: string;
  name: string;
  contact: string | null;
  institution: string | null;
  classLevel: string | null;
  permissions: Permissions;
  linkedAt: string;
}

/** GET /api/me/guardians */
export interface LiveGuardian {
  guardianId: string;
  name: string;
  contact: string | null;
  permissions: Permissions;
  linkedAt: string;
}

const PERMS: { key: keyof Permissions; label: string }[] = [
  { key: "viewOrders", label: "View orders" },
  { key: "viewPayments", label: "View payments" },
  { key: "payOnBehalf", label: "Pay on behalf" },
];

/** The API decides the rules (limits, one-time codes); errors are shown as it words them. */
async function call<T>(path: string, method = "GET", body?: object): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    ...(body
      ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
      : {}),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? `Error ${res.status}`);
  return json as T;
}

const hueOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

/** Guardian side: real linked children, link with contact + code, unlink. */
export function LiveChildrenManager({ kids: initial }: { kids: LiveChild[] }) {
  const toast = useToast();
  const [kids, setKids] = useState(initial);
  const [f, setF] = useState({ contact: "", code: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [unlink, setUnlink] = useState<LiveChild | null>(null);

  const link = async () => {
    const er: Record<string, string> = {};
    if (f.contact.trim().length < 3) er.contact = "Enter your child's email or mobile number";
    if (!/^[A-Z0-9]{6,12}$/.test(f.code.toUpperCase().replace(/[^A-Z0-9]/g, "")))
      er.code = "Enter the 8-character code from your child";
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const child = await call<LiveChild>("/guardian/children", "POST", f);
      setKids((k) => [...k, child]);
      setF({ contact: "", code: "" });
      toast({ tone: "success", title: `${child.name} is linked` });
    } catch (e) {
      toast({ tone: "danger", title: "Not linked", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4" data-testid="linked-children">
        {kids.length === 0 && (
          <Card>
            <EmptyState
              title="No children linked yet"
              body="Ask your child for a link code from Student → Profile, then enter it here."
            />
          </Card>
        )}
        {kids.map((c) => (
          <Card key={c.studentId} className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={c.name} hue={hueOf(c.studentId)} size={48} />
              <div className="min-w-0 flex-1">
                <p className="font-bold">{c.name}</p>
                <p className="text-sm text-muted">
                  {[c.classLevel, c.institution].filter(Boolean).join(" · ") || c.contact}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setUnlink(c)}>
                <Unlink size={14} /> Unlink
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted">
              Order and payment summaries appear here once orders are live.
            </p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {PERMS.map((p) => (
                <span key={p.key}>
                  {c.permissions[p.key] ? "✓" : "✗"} {p.label}
                </span>
              ))}
              <span className="italic">Set by {c.name.split(" ")[0]}</span>
            </p>
          </Card>
        ))}
      </div>
      <Card className="h-fit">
        <CardHeader
          title="Link a child"
          sub="Your child creates a one-time code in Student → Profile."
        />
        <form
          noValidate
          className="space-y-4 p-5"
          onSubmit={(e) => (e.preventDefault(), void link())}
        >
          <Field label="Child's email or mobile" required htmlFor="g-e" error={err.contact}>
            <input
              id="g-e"
              className="input"
              autoComplete="off"
              value={f.contact}
              onChange={(e) => setF({ ...f, contact: e.target.value })}
            />
          </Field>
          <Field label="Link code" required htmlFor="g-c" error={err.code}>
            <input
              id="g-c"
              className="input font-mono uppercase"
              autoComplete="off"
              value={f.code}
              onChange={(e) => setF({ ...f, code: e.target.value })}
            />
          </Field>
          <Button type="submit" variant="accent" className="w-full" disabled={busy}>
            <Link2 size={16} /> Link child
          </Button>
          <p className="flex gap-2 text-[11px] text-muted">
            <ShieldCheck size={14} className="shrink-0" /> Codes work once and expire after 24
            hours. Up to 6 children. Your child decides what you can see.
          </p>
        </form>
      </Card>
      <Modal
        open={!!unlink}
        onClose={() => setUnlink(null)}
        title={`Unlink ${unlink?.name}?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setUnlink(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                const c = unlink!;
                setBusy(true);
                try {
                  await call(`/guardian/children/${c.studentId}`, "DELETE");
                  setKids((k) => k.filter((x) => x.studentId !== c.studentId));
                  setUnlink(null);
                  toast({ tone: "success", title: `${c.name} unlinked` });
                } catch (e) {
                  toast({ tone: "danger", title: "Not saved", body: (e as Error).message });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Unlink
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          You will immediately lose access to their orders and payments. They can link you again
          with a new code.
        </p>
      </Modal>
    </div>
  );
}

/** Student side: create a code, see linked guardians, set their permissions, unlink. */
export function LiveGuardianLinks({
  guardians: initial,
  codeExpiresAt,
}: {
  guardians: LiveGuardian[];
  codeExpiresAt: string | null;
}) {
  const { lang } = useT();
  const toast = useToast();
  const [guardians, setGuardians] = useState(initial);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [activeUntil, setActiveUntil] = useState(codeExpiresAt);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast({ tone: "danger", title: "Not saved", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5" data-testid="guardian-links">
      <p className="flex items-center gap-2 text-sm font-bold">
        <KeyRound size={16} /> Link a guardian
      </p>
      <p className="mt-1 text-xs text-muted">
        Create a one-time code and give it to your parent or guardian with your email or mobile. You
        decide what they can see.
      </p>
      {code ? (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <span
              data-testid="guardian-code"
              className="rounded-lg bg-slate-50 px-3 py-2 font-mono font-bold tracking-widest"
            >
              {code.code}
            </span>
            <CopyButton text={code.code} />
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Shown once. Works once, until {formatDate(code.expiresAt, lang, true)}.
          </p>
        </div>
      ) : (
        activeUntil && (
          <p className="mt-2 text-[11px] text-muted">
            A code is active until {formatDate(activeUntil, lang, true)}. Creating a new one cancels
            it.
          </p>
        )
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const c = await call<{ code: string; expiresAt: string }>(
                "/me/guardian-code",
                "POST",
              );
              setCode(c);
              setActiveUntil(c.expiresAt);
            })
          }
        >
          {code || activeUntil ? "Create a new code" : "Generate link code"}
        </Button>
        {(code || activeUntil) && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await call("/me/guardian-code", "DELETE");
                setCode(null);
                setActiveUntil(null);
              })
            }
          >
            Cancel code
          </Button>
        )}
      </div>

      <p className="mt-5 text-xs font-bold text-muted uppercase">Linked guardians</p>
      {guardians.length === 0 ? (
        <p className="mt-1 text-xs text-muted">None yet.</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {guardians.map((g) => (
            <li key={g.guardianId} className="rounded-lg border border-line p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{g.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await call(`/me/guardians/${g.guardianId}`, "DELETE");
                      setGuardians((xs) => xs.filter((x) => x.guardianId !== g.guardianId));
                      toast({ tone: "success", title: `${g.name} unlinked` });
                    })
                  }
                >
                  <Unlink size={14} /> Unlink
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {PERMS.map((p) => (
                  <label key={p.key} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={g.permissions[p.key]}
                      onChange={(e) => {
                        const next = { ...g.permissions, [p.key]: e.target.checked };
                        const put = (x: LiveGuardian) =>
                          setGuardians((xs) =>
                            xs.map((y) => (y.guardianId === x.guardianId ? x : y)),
                          );
                        // Show the change at once; put it back if the server refuses.
                        put({ ...g, permissions: next });
                        void run(async () => {
                          try {
                            put(
                              await call<LiveGuardian>(
                                `/me/guardians/${g.guardianId}`,
                                "PUT",
                                next,
                              ),
                            );
                          } catch (err) {
                            put(g);
                            throw err;
                          }
                        });
                      }}
                      className="accent-[var(--color-accent)]"
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
