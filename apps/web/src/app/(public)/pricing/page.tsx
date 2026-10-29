import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { PageHero } from "@/components/public/kit";
import { buttonClass, Card } from "@/components/ui";

export const metadata: Metadata = { title: "Pricing" };

const ROWS = [
  ["Digital (typed) assignment", "৳60–90 / page", "1–3 days"],
  ["Handwritten assignment", "৳40–60 / page", "2–4 days"],
  ["Practical khata", "৳40–60 / page", "3–5 days"],
  ["Biology drawing (A4/A3)", "৳200–350 / drawing", "1–2 days"],
  ["Pencil sketch", "৳250–400 / sketch", "2–3 days"],
  ["Diagram / illustration", "৳120–200 / diagram", "1–2 days"],
  ["Project & report", "From ৳800", "3–7 days"],
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        title="Simple, transparent pricing"
        sub="Each mentor sets prices within these typical ranges. You see the full price before paying — no hidden fees."
        crumbs={[{ label: "Pricing" }]}
      />
      <div className="container-x space-y-8 py-8">
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Typical price</th>
                <th className="px-4 py-3">Typical delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ROWS.map(([a, b, c]) => (
                <tr key={a}>
                  <td className="px-4 py-3 font-medium">{a}</td>
                  <td className="px-4 py-3">{b}</td>
                  <td className="px-4 py-3 text-muted">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [
              "Every order includes",
              [
                "2–3 free revisions",
                "Order chat with your mentor",
                "Watermarked previews",
                "Delivery countdown",
                "Support & dispute resolution",
              ],
            ],
            [
              "Extras",
              [
                "Courier delivery ৳120 (Bangladesh)",
                "Extra revision after free ones: set by admin",
                "Urgent (< 24 h): mentor's urgent rate",
              ],
            ],
            [
              "How money flows",
              [
                "You pay the platform",
                "Mentor receives 80% after you approve",
                "Platform commission 20% (configurable)",
                "Full refund if no mentor accepts",
              ],
            ],
          ].map(([title, items]) => (
            <Card key={title as string} className="p-5">
              <h2 className="mb-3 font-bold">{title as string}</h2>
              <ul className="space-y-2 text-sm">
                {(items as string[]).map((i) => (
                  <li key={i} className="flex gap-2">
                    <Check size={16} className="mt-0.5 shrink-0 text-success" />
                    {i}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted">
          Ranges are indicative for the design review; final values are configured by admins.
        </p>
        <Link href="/order/new" className={buttonClass("primary", "lg")}>
          Get a price for your assignment
        </Link>
      </div>
    </>
  );
}
