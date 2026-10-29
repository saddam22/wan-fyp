import { ContentAdmin, type Post } from "@/components/dash/live-trust";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { PagesCMS } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default async function AdminPages() {
  if (authMode() === "wan") {
    const res = await apiFetch("/admin/content?kind=page");
    if (!res.ok) return <ApiProblem status={res.status} />;
    return (
      <>
        <PageHeader title="Pages (CMS)" sub="Published pages are shown at /p/address." />
        <ContentAdmin kind="page" items={(await res.json()) as Post[]} />
      </>
    );
  }
  return (
    <>
      <PageHeader title="Pages (CMS)" />
      <PagesCMS />
    </>
  );
}
