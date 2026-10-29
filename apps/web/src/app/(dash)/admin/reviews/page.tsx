import { LiveReviews, type LiveReview } from "@/components/dash/admin-market";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { fixtures } from "@edukhata/contracts";
import { ReviewsModeration } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

async function LiveReviewsList() {
  const res = await apiFetch("/admin/reviews");
  if (!res.ok) return <ApiProblem status={res.status} />;
  return <LiveReviews reviews={(await res.json()) as LiveReview[]} />;
}

export default function AdminReviews() {
  return (
    <>
      <PageHeader
        title="Reviews"
        sub="Publish or hide reviews. Only verified orders can be reviewed."
      />
      {authMode() === "wan" ? (
        <LiveReviewsList />
      ) : (
        <ReviewsModeration reviews={fixtures.reviews} />
      )}
    </>
  );
}
