import type { Metadata } from "next";
import { Award, BadgeCheck, CalendarCheck, Wallet } from "lucide-react";
import { PageHero } from "@/components/public/kit";
import { MentorApplicationForm } from "@/components/public/MentorApplicationForm";
import { Card } from "@/components/ui";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Become a Mentor",
  description:
    "Earn by preparing assignments, practical khata and drawings. Keep 80% of every order.",
};

export default async function BecomeMentorPage() {
  const session = await getSession();
  const perks = [
    [Wallet, "Keep 80%", "Platform commission is 20%. Payouts to bKash, Nagad or bank."],
    [CalendarCheck, "Your schedule", "Set availability and how many orders you take at once."],
    [BadgeCheck, "Earn trust", "Verified badge after document review and a skill test."],
    [Award, "Grow your rank", "Ratings and on-time delivery lift your ranking — organically."],
  ] as const;
  return (
    <>
      <PageHero
        title="Become a Mentor"
        sub="Share your knowledge, prepare assignments and practical khata, and earn — on your schedule."
        crumbs={[{ label: "Become a Mentor" }]}
      />
      <div className="container-x grid gap-6 py-8 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3">
          {perks.map(([Icon, t, b]) => (
            <Card key={t} className="flex gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
                <Icon size={20} />
              </span>
              <div>
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-muted">{b}</p>
              </div>
            </Card>
          ))}
          <Card className="p-4 text-sm text-muted">
            <p className="font-semibold text-ink">How approval works</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Sign in with your WAN ID</li>
              <li>Submit this application</li>
              <li>Document review by our team</li>
              <li>Subject skill test</li>
              <li>Mentor role granted by an EduKhata admin</li>
            </ol>
          </Card>
        </div>
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-bold">Mentor application</h2>
          <p className="mb-5 text-sm text-muted">
            {session
              ? `Applying as ${session.name}.`
              : "You'll be asked to sign in with your WAN ID before submitting (demo: the form works without it)."}
          </p>
          <MentorApplicationForm />
        </Card>
      </div>
    </>
  );
}
