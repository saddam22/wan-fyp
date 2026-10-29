import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/OnboardingForm";
import { Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { REF_COOKIE } from "@/lib/referral";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Complete your profile", robots: { index: false } };

export default async function OnboardingPage() {
  const live = authMode() === "wan";
  const session = live ? await getSession() : null;
  if (live && !session) redirect("/login?next=/onboarding");
  if (session?.onboardingComplete) redirect(session.home);
  const ref = live ? (await cookies()).get(REF_COOKIE)?.value : undefined;
  const invite = ref
    ? ((await (
        await apiFetch(`/referrals/resolve/${encodeURIComponent(ref)}`)
      )
        .json()
        .catch(() => null)) as { valid: boolean; name?: string } | null)
    : null;
  return (
    <Card className="w-full max-w-2xl p-6 sm:p-8">
      <h1 className="text-xl font-extrabold">Welcome to EduKhata</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Your WAN ID is connected. Tell us a little about you to finish setting up — dashboards
        unlock after this step.
      </p>
      <OnboardingForm
        live={live}
        {...(session ? { name: session.name } : {})}
        {...(invite?.valid && invite.name ? { invitedBy: invite.name } : {})}
      />
    </Card>
  );
}
