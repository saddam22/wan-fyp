import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fixtures, formatDate } from "@edukhata/contracts";
import { PostText } from "@/components/dash/live-trust";
import { getPost, getPosts } from "@/lib/blog";
import { AdSlot, BlogCover } from "@/components/public/home";
import { Prose } from "@/components/public/kit";
import { buttonClass, Card } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export function generateStaticParams() {
  return fixtures.blogPosts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const p = await getPost((await params).slug);
  return p
    ? {
        title: p.title,
        description: p.excerpt,
        openGraph: { type: "article", title: p.title, description: p.excerpt },
      }
    : {};
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getPost((await params).slug);
  if (!p) notFound();
  const more = (await getPosts()).filter((x) => x.slug !== p.slug).slice(0, 6);
  const { t, lang } = await getT();
  return (
    <div className="container-x py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted">
        <Link href="/" className="hover:underline">
          Home
        </Link>{" "}
        /{" "}
        <Link href="/blog" className="hover:underline">
          Blog
        </Link>{" "}
        / <span className="text-ink">{p.title}</span>
      </nav>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="card overflow-hidden">
          <BlogCover hue={p.hue} tag={p.tag} tall />
          <div className="p-6 sm:p-10">
            <h1 className="text-2xl font-extrabold sm:text-3xl">{p.title}</h1>
            <p className="mt-2 text-sm text-muted">
              {p.author} · {formatDate(p.at, lang)} · {p.readMinutes} min read
            </p>
            <div className="mt-6">
              {p.text !== undefined ? (
                <PostText body={p.text} />
              ) : (
                <Prose>
                  {p.body.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </Prose>
              )}
            </div>
            <div className="mt-8">
              <AdSlot t={t} placement="blog-end" />
            </div>
          </div>
        </article>
        <aside className="space-y-4">
          <Card className="p-5">
            <p className="font-bold">Need help with your practical?</p>
            <p className="mt-1 text-sm text-muted">
              Verified mentors, free revisions, secure payment.
            </p>
            <Link href="/order/new" className={buttonClass("primary", "md", "mt-3 w-full")}>
              Post an assignment
            </Link>
          </Card>
          <Card className="p-5">
            <p className="mb-2 font-bold">More articles</p>
            <ul className="space-y-2 text-sm">
              {more.map((x) => (
                <li key={x.slug}>
                  <Link href={`/blog/${x.slug}`} className="text-brand-600 hover:underline">
                    {x.title}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
