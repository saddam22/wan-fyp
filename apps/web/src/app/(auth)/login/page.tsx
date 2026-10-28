import type { Metadata } from "next";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { demoSignIn } from "@/lib/actions";
import { DEMO_MODE } from "@/lib/site";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const DEMO_ACCOUNTS = [
  ["student", "Student", "Mahfuz Rahman — orders, payments, chat"],
  ["mentor", "Mentor", "Dr. Mizanur Rahman — offers, deliveries, earnings"],
  ["guardian", "Guardian", "Shirin Akter — linked children"],
  ["accountant", "Accountant", "Rumana Haque — payment verification, ledger"],
  ["supporter", "Supporter", "Joya Akter — tickets, escalations"],
  ["admin", "Admin", "Karim Uddin — operations (no system settings)"],
  ["super_admin", "Super Admin", "Everything incl. roles, settings, audit"],
  ["student,guardian", "Student + Guardian", "Shows a multi-role account"],
] as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const { next = "", mode } = await searchParams;
  return (
    <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-2">
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold">
          {mode === "register" ? "Create your account" : "Sign in"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          EduKhata uses your WAN ID — one account for all WANBAHJAHKAS platforms.
        </p>
        <button
          disabled
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-navy text-sm font-semibold text-white opacity-60"
          title="Connected in Phase 2"
        >
          <KeyRound size={18} /> Continue with WAN ID
        </button>
        <p className="mt-2 text-center text-xs text-muted">
          {mode === "register"
            ? "Registration happens on WAN Identity Hub, then you return here."
            : "Password, OTP and two-factor are handled by WAN Identity Hub."}
        </p>
        <ul className="mt-6 space-y-2 text-sm text-slate-700">
          <li className="flex gap-2">
            <ShieldCheck size={16} className="mt-0.5 text-success" /> Signing in never grants mentor
            or staff roles by itself.
          </li>
          <li className="flex gap-2">
            <ShieldCheck size={16} className="mt-0.5 text-success" /> New users complete a short
            EduKhata profile first.
          </li>
        </ul>
        <p className="mt-6 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          The WAN ID button is inactive in this preview. Phase 2 connects it (OpenID Connect) after
          the hub adds an EduKhata client.
        </p>
      </Card>
      {DEMO_MODE && (
        <Card className="p-6 sm:p-8">
          <h2 className="text-lg font-bold">Demo sign-in</h2>
          <p className="mt-1 text-sm text-muted">
            Pick a role to preview its dashboard. Not authentication — removed when WAN sign-in is
            connected.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map(([roles, label, sub]) => (
              <li key={roles}>
                <form action={demoSignIn}>
                  <input type="hidden" name="roles" value={roles} />
                  <input type="hidden" name="next" value={next} />
                  <button
                    data-testid={`demo-${roles}`}
                    className="h-full w-full rounded-xl border border-line bg-white p-3 text-left transition hover:border-brand-600 hover:bg-brand-50"
                  >
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="block text-[11px] text-muted">{sub}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
