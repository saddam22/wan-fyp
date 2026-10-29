import type { Metadata } from "next";
import { BadgeCheck, Globe2, HeartHandshake, ShieldCheck } from "lucide-react";
import { PageHero, Prose } from "@/components/public/kit";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "About Us" };

export default function AboutPage() {
  const values = [
    [
      BadgeCheck,
      "Verified, not bought",
      "Verification is earned through document review and skill tests. Paid promotions are always labelled.",
    ],
    [
      ShieldCheck,
      "Protected payments",
      "Mentors are paid only after the student approves, with a clear dispute process.",
    ],
    [
      HeartHandshake,
      "Learning first",
      "Reference work, clear academic-integrity rules and study guides.",
    ],
    [
      Globe2,
      "Bangladesh first",
      "Built for Bangladeshi boards and payment methods, ready to grow internationally.",
    ],
  ] as const;
  return (
    <>
      <PageHero
        title="About EduKhata"
        sub="A WANBAHJAHKAS platform connecting students with trusted mentors."
        crumbs={[{ label: "About" }]}
      />
      <div className="container-x space-y-8 py-8">
        <Card className="p-6 sm:p-10">
          <Prose>
            <p>
              EduKhata helps students in Bangladesh get reliable help with assignments, handwritten
              practical khata, biology drawings, diagrams and projects. Every mentor is reviewed
              before they can take orders, every order has a deadline and revisions, and payment
              reaches the mentor only after the student is satisfied.
            </p>
            <p>
              EduKhata is part of the WANBAHJAHKAS ecosystem: you sign in with the same WAN ID used
              across WAN platforms, and the platform reuses WAN&apos;s chat, calling, notification
              and advertising services.
            </p>
          </Prose>
        </Card>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {values.map(([Icon, t, b]) => (
            <li key={t} className="card p-5">
              <Icon size={24} className="mb-2 text-brand-600" />
              <p className="font-bold">{t}</p>
              <p className="text-sm text-muted">{b}</p>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
