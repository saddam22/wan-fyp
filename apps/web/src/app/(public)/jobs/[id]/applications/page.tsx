import { JobApplicationsScreen } from "@local-hub/ui";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <JobApplicationsScreen id={(await params).id} />;
}
