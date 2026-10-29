import { ContentAdmin, type Post } from "@/components/dash/live-trust";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { BlogManager } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default async function AdminBlog() {
  if (authMode() === "wan") {
    const res = await apiFetch("/admin/content?kind=blog");
    if (!res.ok) return <ApiProblem status={res.status} />;
    return (
      <>
        <PageHeader
          title="Blog"
          sub="Mentors submit posts; an admin other than the author publishes them."
        />
        <ContentAdmin kind="blog" items={(await res.json()) as Post[]} />
      </>
    );
  }
  return (
    <>
      <PageHeader title="Blog" />
      <BlogManager />
    </>
  );
}
