import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, KeyRound, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { demoSignIn } from "@/lib/actions";
import { authMode } from "@/lib/auth-mode";
import { getSession } from "@/lib/session";
import { WAN_HUB_URL } from "@/lib/site";

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

const ERRORS: Record<string, string> = {
  expired: "That sign-in took too long or was already used. Please try again.",
  signin: "WAN sign-in could not be verified. Please try again.",
};

const safeNext = (n: string) => (/^\/(?![/\\])/.test(n) ? n : "");

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string; error?: string }>;
}) {
  const { next = "", mode, error } = await searchParams;
  const wan = authMode() === "wan";
  const session = wan ? await getSession() : null;
  if (session)
    redirect(session.onboardingComplete ? safeNext(next) || session.home : "/onboarding");
  const loginHref = `/api/auth/login${safeNext(next) ? `?next=${encodeURIComponent(safeNext(next))}` : ""}`;
  return (
    <div className={`grid w-full gap-6 ${wan ? "max-w-md" : "max-w-5xl lg:grid-cols-2"}`}>
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold">
          {mode === "register" ? "Create your account" : "Sign in"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          EduKhata uses your WAN ID — one account for all WANBAHJAHKAS platforms.
        </p>
        {error && ERRORS[error] && (
          <p role="alert" className="mt-4 flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {ERRORS[error]}
          </p>
        )}
        {wan ? (
          <a
            href={loginHref}
            data-testid="wan-login"
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-navy text-sm font-semibold text-white hover:bg-navy-2"
          >
            <KeyRound size={18} /> Continue with WAN ID
          </a>
        ) : (
          <button
            disabled
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-navy text-sm font-semibold text-white opacity-60"
            title="AUTH_MODE=demo"
          >
            <KeyRound size={18} /> Continue with WAN ID
          </button>
        )}
        <p className="mt-2 text-center text-xs text-muted">
          {mode === "register"
            ? "Registration happens on WAN Identity Hub, then you come straight back here."
            : "Password, OTP and two-factor are handled by WAN Identity Hub."}
        </p>
        <p className="mt-1 text-center text-xs text-muted">
          No WAN ID yet? Continue and choose <b>Register</b> on the WAN page.{" "}
          <a
            href={WAN_HUB_URL}
            className="text-brand-600 underline"
            target="_blank"
            rel="noreferrer"
          >
            About WAN ID
          </a>
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
        {!wan && (
          <p className="mt-6 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            Demo mode (AUTH_MODE=demo): WAN sign-in is off; use the demo role picker.
          </p>
        )}
      </Card>
      {!wan && (
        <Card className="p-6 sm:p-8">
          <h2 className="text-lg font-bold">Demo sign-in</h2>
          <p className="mt-1 text-sm text-muted">
            Pick a role to preview its dashboard. Not authentication — only available when
            AUTH_MODE=demo.
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
