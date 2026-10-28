import type { Metadata } from "next";
import Link from "next/link";
import { fixtures, mockApi } from "@edukhata/contracts";
import { CategoryCard } from "@/components/public/home";
import { PageHero } from "@/components/public/kit";
import { MentorCard } from "@/components/public/MentorCard";
import { buttonClass, Card, EmptyState } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; subject?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const { lang } = await getT();
  const ql = q.toLowerCase();
  const mentors = mockApi.mentors({ q, subject: sp.subject });
  const cats = fixtures.categories.filter(
    (c) =>
      (!sp.category || c.slug === sp.category) &&
      (!ql || `${c.name} ${c.nameBn} ${c.description}`.toLowerCase().includes(ql)),
  );
  const posts = fixtures.blogPosts.filter(
    (p) => !ql || `${p.title} ${p.excerpt}`.toLowerCase().includes(ql),
  );
  const total = mentors.length + cats.length + posts.length;
  return (
    <>
      <PageHero
        title={q ? `Results for “${q}”` : "Search"}
        sub={`${total} result${total === 1 ? "" : "s"}`}
        crumbs={[{ label: "Search" }]}
      />
      <div className="container-x space-y-8 py-8">
        {total === 0 && (
          <Card>
            <EmptyState
              title="Nothing found"
              body="Try a subject name like Biology or ICT, or post your assignment and we'll match a mentor."
              action={
                <Link href="/order/new" className={buttonClass("primary", "md")}>
                  Post an assignment
                </Link>
              }
            />
          </Card>
        )}
        {cats.length > 0 && (
          <section>
            <h2 className="mb-3 font-bold">Categories</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {cats.map((c) => (
                <CategoryCard key={c.slug} c={c} lang={lang} />
              ))}
            </div>
          </section>
        )}
        {mentors.length > 0 && (
          <section>
            <h2 className="mb-3 font-bold">Mentors</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
              {mentors.map((m) => (
                <MentorCard key={m.id} m={m} />
              ))}
            </div>
          </section>
        )}
        {posts.length > 0 && (
          <section>
            <h2 className="mb-3 font-bold">Articles</h2>
            <ul className="space-y-2">
              {posts.map((p) => (
                <li key={p.slug}>
                  <Link href={`/blog/${p.slug}`} className="text-brand-600 hover:underline">
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
