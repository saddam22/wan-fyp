import { notFound } from "next/navigation";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { MyPosts, type Post } from "@/components/dash/live-trust";
import { PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

export default async function MentorBlog() {
  if (authMode() !== "wan") notFound();
  const res = await apiFetch("/me/posts");
  if (!res.ok) return <ApiProblem status={res.status} />;
  return (
    <>
      <PageHeader
        title="Write for the Blog"
        sub="Study tips and guides. An editor reviews each post."
      />
      <MyPosts items={(await res.json()) as Post[]} />
    </>
  );
}
