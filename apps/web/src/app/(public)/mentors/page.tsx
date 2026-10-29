import type { Metadata } from "next";
import { Suspense } from "react";
import { MentorSearch } from "@/components/public/MentorSearch";
import { PageHero } from "@/components/public/kit";
import { Skeleton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Find a Mentor",
  description:
    "Browse verified mentors for assignments, practical khata, biology drawings and diagrams.",
};

export default function MentorsPage() {
  return (
    <>
      <PageHero
        title="Find a Mentor"
        sub="Verified mentors for every subject — compare ratings, prices and delivery time."
        crumbs={[{ label: "Mentors" }]}
      />
      <div className="container-x py-6">
        <Suspense
          fallback={
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-72" />
              ))}
            </div>
          }
        >
          <MentorSearch />
        </Suspense>
      </div>
    </>
  );
}
