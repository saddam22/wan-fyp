"use client";

import { useState } from "react";
import { Link2, ShieldCheck, Unlink } from "lucide-react";
import { formatMoney, type ChildLink } from "@edukhata/contracts";
import { Avatar, Button, Card, CardHeader, Field } from "@/components/ui";
import { Modal, useToast } from "@/components/ui/client";
import { useT } from "@/lib/i18n/client";

export function ChildrenManager({ kids: initial }: { kids: ChildLink[] }) {
  const { lang } = useT();
  const toast = useToast();
  const [kids, setKids] = useState(initial);
  const [f, setF] = useState({ email: "", code: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [unlink, setUnlink] = useState<ChildLink | null>(null);
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        {kids.map((c) => (
          <Card key={c.studentId} className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={c.name} hue={c.studentId === "s2" ? 210 : 330} size={48} />
              <div className="min-w-0 flex-1">
                <p className="font-bold">{c.name}</p>
                <p className="text-sm text-muted">
                  {c.classLevel} · {c.institution}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setUnlink(c)}>
                <Unlink size={14} /> Unlink
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-lg font-bold">{c.activeOrders}</p>
                <p className="text-[11px] text-muted">Active</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-lg font-bold">{c.completedOrders}</p>
                <p className="text-[11px] text-muted">Completed</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-lg font-bold">
                  {c.permissions.viewPayments
                    ? formatMoney({ amountMinor: c.spentMinor, currency: "BDT" }, lang)
                    : "—"}
                </p>
                <p className="text-[11px] text-muted">Spent</p>
              </div>
            </div>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span>{c.permissions.viewOrders ? "✓" : "✗"} View orders</span>
              <span>{c.permissions.viewPayments ? "✓" : "✗"} View payments</span>
              <span>{c.permissions.payOnBehalf ? "✓" : "✗"} Pay on behalf</span>
              <span className="italic">Set by {c.name.split(" ")[0]}</span>
            </p>
          </Card>
        ))}
      </div>
      <Card className="h-fit">
        <CardHeader
          title="Link a child"
          sub="Your child generates a one-time code in Student → Profile."
        />
        <form
          noValidate
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const er: Record<string, string> = {};
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email))
              er.email = "Enter your child's EduKhata email";
            if (!/^[A-Z0-9]{6,10}$/.test(f.code.trim().toUpperCase()))
              er.code = "Codes are 6–10 letters/numbers";
            if (!er.email && kids.length >= 6) er.email = "Up to 6 children can be linked";
            setErr(er);
            if (Object.keys(er).length) return;
            // Same message for wrong email or wrong code, so accounts can't be probed.
            toast({
              tone: "danger",
              title: "Email or link code is not correct",
              body: "Demo: no real accounts. Codes work once and expire.",
            });
          }}
        >
          <Field label="Child's email" required htmlFor="g-e" error={err.email}>
            <input
              id="g-e"
              className="input"
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
            />
          </Field>
          <Field label="Link code" required htmlFor="g-c" error={err.code}>
            <input
              id="g-c"
              className="input font-mono uppercase"
              value={f.code}
              onChange={(e) => setF({ ...f, code: e.target.value })}
            />
          </Field>
          <Button type="submit" variant="accent" className="w-full">
            <Link2 size={16} /> Link child
          </Button>
          <p className="flex gap-2 text-[11px] text-muted">
            <ShieldCheck size={14} className="shrink-0" /> Following ICTSpark&apos;s guardian rules:
            one-time codes, max 6 children, the student controls permissions.
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
              onClick={() => (
                setKids((k) => k.filter((x) => x.studentId !== unlink!.studentId)),
                setUnlink(null),
                toast({ tone: "success", title: "Unlinked", body: "Demo only — not saved." })
              )}
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
