import { notFound } from "next/navigation";
import { PageHero } from "@/components/public/kit";
import { PostText } from "@/components/dash/live-trust";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

/** A page written in the admin CMS. */
export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  if (authMode() !== "wan") notFound();
  const res = await apiFetch(`/content/pages/${encodeURIComponent((await params).slug)}`);
  if (!res.ok) notFound();
  const p = (await res.json()) as { title: string; excerpt: string; body: string };
  return (
    <>
      <PageHero title={p.title} sub={p.excerpt} crumbs={[{ label: p.title }]} />
      <div className="container-x max-w-3xl py-8 text-[15px]">
        <PostText body={p.body} />
      </div>
    </>
  );
}
