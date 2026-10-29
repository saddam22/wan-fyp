import { MessagesAdmin, type ContactMessage } from "@/components/dash/live-site";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { WebsiteMessages } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default async function AdminMessages() {
  if (authMode() === "wan") {
    const res = await apiFetch("/admin/messages");
    if (!res.ok) return <ApiProblem status={res.status} />;
    return (
      <>
        <PageHeader
          title="Website Messages"
          sub="From the contact form, including institutions' academic-integrity reports."
        />
        <MessagesAdmin items={(await res.json()) as ContactMessage[]} />
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Website Messages"
        sub="Messages from the contact form and site chat button."
      />
      <WebsiteMessages />
    </>
  );
}
