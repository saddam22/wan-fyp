import { ModerationQueue } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default function AdminModeration() {
  return (
    <>
      <PageHeader
        title="Moderation"
        sub="Flagged reviews, portfolio items, copyright complaints and chat reports."
      />
      <ModerationQueue />
    </>
  );
}
