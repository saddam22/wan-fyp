import { BlogManager } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default function AdminBlog() {
  return (
    <>
      <PageHeader title="Blog" />
      <BlogManager />
    </>
  );
}
