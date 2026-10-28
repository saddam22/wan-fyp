import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { fixtures } from "@edukhata/contracts";
import { PageHero } from "@/components/public/kit";
import { buttonClass, Card } from "@/components/ui";

export const metadata: Metadata = { title: "Help Center & FAQ" };

const GROUPS = {
  general: "General",
  orders: "Orders & revisions",
  payments: "Payments & refunds",
  mentors: "Mentors & verification",
} as const;

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: fixtures.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return (
    <>
      <PageHero
        title="Help Center & FAQ"
        sub="Answers to common questions about orders, payments and mentors."
        crumbs={[{ label: "FAQ" }]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="container-x grid gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((g) => (
            <section key={g}>
              <h2 className="mb-2 text-lg font-bold">{GROUPS[g]}</h2>
              <Card className="divide-y divide-line">
                {fixtures.faqs
                  .filter((f) => f.group === g)
                  .map((f) => (
                    <details key={f.q} className="group p-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                        {f.q}
                        <ChevronDown
                          size={18}
                          className="shrink-0 transition group-open:rotate-180"
                        />
                      </summary>
                      <p className="mt-2 text-sm text-slate-700">{f.a}</p>
                    </details>
                  ))}
              </Card>
            </section>
          ))}
        </div>
        <Card className="h-fit p-5">
          <p className="font-bold">Still need help?</p>
          <p className="mt-1 text-sm text-muted">
            Our support team replies within a few hours, 7 days a week.
          </p>
          <Link href="/contact" className={buttonClass("primary", "md", "mt-3 w-full")}>
            Contact support
          </Link>
        </Card>
      </div>
    </>
  );
}
