import type { Metadata } from "next";
import Link from "next/link";
import { fixtures } from "@edukhata/contracts";
import { CategoryCard } from "@/components/public/home";
import { PageHero } from "@/components/public/kit";
import { buttonClass, Card } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { LEVEL } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Assignment Categories",
  description:
    "SSC, HSC, university, practical khata, projects and vocational work — browse by category and subject.",
};

export default async function AssignmentsPage() {
  const { lang } = await getT();
  return (
    <>
      <PageHero
        title="Assignments & Categories"
        sub="From school to university — typed, handwritten and practical work."
        crumbs={[{ label: "Assignments" }]}
      >
        <Link href="/order/new" className={buttonClass("white", "md")}>
          Post an assignment
        </Link>
      </PageHero>
      <div className="container-x space-y-8 py-8">
        <section>
          <h2 className="mb-3 text-lg font-bold">All categories</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {fixtures.categories.map((c) => (
              <CategoryCard key={c.slug} c={c} lang={lang} />
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-bold">Subjects</h2>
          <Card className="divide-y divide-line">
            {fixtures.subjects.map((s) => (
              <div
                key={s.id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{lang === "bn" ? s.nameBn : s.name}</p>
                  <p className="text-xs text-muted">{s.levels.map((l) => LEVEL[l]).join(" · ")}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/mentors?subject=${s.id}`} className={buttonClass("outline", "sm")}>
                    Mentors
                  </Link>
                  <Link
                    href={`/order/new?subject=${s.id}`}
                    className={buttonClass("secondary", "sm")}
                  >
                    Order
                  </Link>
                </div>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </>
  );
}
