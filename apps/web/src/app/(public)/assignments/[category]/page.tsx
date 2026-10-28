import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fixtures, formatMoney, formatNumber, mockApi } from "@edukhata/contracts";
import { MentorCard } from "@/components/public/MentorCard";
import { PageHero } from "@/components/public/kit";
import { buttonClass, Card } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { LEVEL, subjectName, WORK_TYPE } from "@/lib/labels";

export function generateStaticParams() {
  return fixtures.categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const c = mockApi.category((await params).category);
  return c ? { title: c.name, description: c.description } : {};
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const c = mockApi.category((await params).category);
  if (!c) notFound();
  const { lang } = await getT();
  const orders = fixtures.orders.filter((o) => o.categorySlug === c.slug);
  const mentors = mockApi.mentors().slice(0, 4);
  return (
    <>
      <PageHero
        title={lang === "bn" ? c.nameBn : c.name}
        sub={`${c.description} · ${formatNumber(c.taskCount, lang)}+ tasks completed`}
        crumbs={[{ label: "Assignments", href: "/assignments" }, { label: c.name }]}
      >
        <Link href={`/order/new?category=${c.slug}`} className={buttonClass("white", "md")}>
          Order in this category
        </Link>
      </PageHero>
      <div className="container-x space-y-8 py-8">
        <section>
          <h2 className="mb-3 text-lg font-bold">Recent requests</h2>
          {orders.length === 0 ? (
            <Card className="p-6 text-sm text-muted">
              No recent public requests in this category. Be the first — post your assignment.
            </Card>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {orders.map((o) => (
                <li key={o.id} className="card p-4">
                  <p className="font-semibold">{o.title}</p>
                  <p className="text-xs text-muted">
                    {LEVEL[o.level]} · {subjectName(o.subject, lang)} · {WORK_TYPE[o.workType]} ·{" "}
                    {o.pages} pages
                  </p>
                  <p className="mt-2 font-bold">{formatMoney(o.price, lang)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-lg font-bold">Mentors for this category</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {mentors.map((m) => (
              <MentorCard key={m.id} m={m} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
