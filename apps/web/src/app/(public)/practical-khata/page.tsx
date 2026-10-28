import type { Metadata } from "next";
import Link from "next/link";
import { BookCheck, Camera, FlaskConical, PenLine, Ruler, Truck } from "lucide-react";
import { mockApi } from "@edukhata/contracts";
import { MentorCard } from "@/components/public/MentorCard";
import { PageHero } from "@/components/public/kit";
import { buttonClass, Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Practical Khata (Handwritten)",
  description:
    "Neat handwritten practical notebooks for Biology, Physics, Chemistry and ICT — scanned preview first, then courier delivery.",
};

export default function PracticalKhataPage() {
  const features = [
    [PenLine, "Neat handwriting", "Blue/black ink, your school's format and margins."],
    [Ruler, "Labelled diagrams", "Pencil diagrams drawn to board standard."],
    [FlaskConical, "Every experiment", "Aim, apparatus, procedure, table, result, precautions."],
    [Camera, "Scanned preview", "Check every page before it is posted."],
    [Truck, "Courier delivery", "Original khata delivered to your address."],
    [BookCheck, "Free revisions", "Corrections included before final delivery."],
  ] as const;
  return (
    <>
      <PageHero
        title="Practical Khata"
        sub="Handwritten practical notebooks prepared by verified mentors — scanned preview first, then the original by courier."
        crumbs={[{ label: "Practical Khata" }]}
      >
        <Link href="/order/new?category=practical-khata" className={buttonClass("white", "md")}>
          Order a practical khata
        </Link>
      </PageHero>
      <div className="container-x space-y-8 py-8">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([Icon, t, s]) => (
            <li key={t} className="card flex gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Icon size={20} />
              </span>
              <div>
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-muted">{s}</p>
              </div>
            </li>
          ))}
        </ul>
        <Card className="grid gap-6 p-6 md:grid-cols-2">
          <div
            className="ruled watermark h-64 rounded-xl bg-white ring-1 ring-line"
            aria-label="Sample practical page (watermarked)"
            role="img"
          />
          <div className="space-y-3 text-sm text-slate-700">
            <h2 className="text-lg font-bold text-ink">What you get</h2>
            <p>
              Each order follows the syllabus and format you upload. The mentor shares watermarked
              progress scans; the clean final scan and the original notebook are released after you
              approve.
            </p>
            <p>
              Typical price: ৳40–60 per page depending on diagrams. Courier inside Bangladesh: ৳120.
            </p>
            <p className="text-xs text-muted">
              Use delivered work in line with your institution&apos;s rules.
            </p>
          </div>
        </Card>
        <section>
          <h2 className="mb-3 text-lg font-bold">Practical khata specialists</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {mockApi
              .mentors({ sort: "orders" })
              .filter((m) => ["biology", "physics", "chemistry", "ict"].includes(m.primarySubject))
              .slice(0, 4)
              .map((m) => (
                <MentorCard key={m.id} m={m} />
              ))}
          </div>
        </section>
      </div>
    </>
  );
}
