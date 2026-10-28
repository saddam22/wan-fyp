import { WebsiteMessages } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default function AdminMessages() {
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
