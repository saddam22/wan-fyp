import { CatalogManager } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default function AdminCatalog() {
  return (
    <>
      <PageHeader title="Catalog" sub="Subjects, categories, classes and education boards." />
      <CatalogManager />
    </>
  );
}
