import { JobDetailScreen } from "@local-hub/ui";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <JobDetailScreen id={(await params).id} />;
}
