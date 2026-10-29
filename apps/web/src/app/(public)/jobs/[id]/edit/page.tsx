import { JobFormScreen } from "@local-hub/ui";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <JobFormScreen id={(await params).id} />;
}
