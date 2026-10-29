import type { Metadata } from "next";
import Link from "next/link";
import { HowItWorks } from "@/components/public/home";
import { PageHero } from "@/components/public/kit";
import { buttonClass, Card } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "How It Works" };

export default async function HowItWorksPage() {
  const { t } = await getT();
  const student = [
    [
      "Post your assignment",
      "Choose category, subject and pages, upload your syllabus or teacher's instructions, set a deadline.",
    ],
    [
      "Pay securely",
      "Send money by bKash, Nagad, Rocket or bank and enter the transaction ID. Our accounts team verifies it.",
    ],
    [
      "Get matched",
      "Your order is offered to available mentors with the right skills. The first to accept is assigned — only one mentor can ever take an order.",
    ],
    ["Track & chat", "Follow the countdown, chat with your mentor and see watermarked previews."],
    [
      "Approve or revise",
      "Request free revisions (2–3 per order) or approve. Final files unlock after approval.",
    ],
    [
      "Mentor gets paid",
      "The mentor's 80% share is released after approval. If something goes wrong, open a dispute and our team decides.",
    ],
  ];
  const mentor = [
    ["Apply", "Sign in with your WAN ID, add education and subjects, upload ID and certificates."],
    [
      "Get verified",
      "Our team reviews your documents and you pass a subject skill test. The Verified badge cannot be bought.",
    ],
    [
      "Receive offers",
      "Accept matching orders within the offer time. Set your availability and capacity.",
    ],
    [
      "Deliver & earn",
      "Upload previews and final files. Earnings become available after approval; request a payout to bKash, Nagad or bank.",
    ],
  ];
  return (
    <>
      <PageHero
        title={t.home.howItWorks}
        sub="A clear, protected process for students, guardians and mentors."
        crumbs={[{ label: t.home.howItWorks }]}
      />
      <div className="container-x space-y-8 py-8">
        <HowItWorks t={t} />
        <div className="grid gap-5 lg:grid-cols-2">
          {[
            ["For students", student, "/order/new", "Post an assignment"],
            ["For mentors", mentor, "/become-a-mentor", "Become a mentor"],
          ].map(([title, steps, href, cta]) => (
            <Card key={title as string} className="p-6">
              <h2 className="mb-4 text-lg font-bold">{title as string}</h2>
              <ol className="space-y-4">
                {(steps as string[][]).map(([h, b], i) => (
                  <li key={h} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold">{h}</p>
                      <p className="text-sm text-muted">{b}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link href={href as string} className={buttonClass("primary", "md", "mt-5")}>
                {cta as string}
              </Link>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
