import { fixtures } from "@edukhata/contracts";
import { ReviewsModeration } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default function AdminReviews() {
  return (
    <>
      <PageHeader
        title="Reviews"
        sub="Publish or hide reviews. Only verified orders can be reviewed."
      />
      <ReviewsModeration reviews={fixtures.reviews} />
    </>
  );
}
