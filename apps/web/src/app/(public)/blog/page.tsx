import type { Metadata } from "next";
import Link from "next/link";
import { fixtures, formatDate } from "@edukhata/contracts";
import { AdSlot, BlogCover } from "@/components/public/home";
import { PageHero } from "@/components/public/kit";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Blog & Study Tips" };

export default async function BlogPage() {
  const { t, lang } = await getT();
  const [first, ...rest] = fixtures.blogPosts;
  return (
    <>
      <PageHero
        title="Blog & Study Tips"
        sub="Practical khata guides, drawing tips and study advice from mentors."
        crumbs={[{ label: "Blog" }]}
      />
      <div className="container-x space-y-6 py-8">
        {first && (
          <Link
            href={`/blog/${first.slug}`}
            className="card group grid overflow-hidden md:grid-cols-2"
          >
            <BlogCover hue={first.hue} tag={first.tag} tall />
            <div className="flex flex-col justify-center gap-2 p-6">
              <p className="text-xs text-muted">
                {formatDate(first.at, lang)} · {first.readMinutes} min · {first.author}
              </p>
              <h2 className="text-2xl font-extrabold group-hover:text-brand-600">{first.title}</h2>
              <p className="text-muted">{first.excerpt}</p>
            </div>
          </Link>
        )}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((p) => (
            <li key={p.slug}>
              <Link href={`/blog/${p.slug}`} className="card group block h-full overflow-hidden">
                <BlogCover hue={p.hue} tag={p.tag} />
                <div className="space-y-1 p-4">
                  <h2 className="font-bold group-hover:text-brand-600">{p.title}</h2>
                  <p className="text-sm text-muted">{p.excerpt}</p>
                  <p className="text-xs text-muted">
                    {formatDate(p.at, lang)} · {p.readMinutes} min
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <AdSlot t={t} placement="blog-list" />
      </div>
    </>
  );
}
