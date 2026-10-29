import type { Metadata } from "next";
import { Suspense } from "react";
import { LiveMentors } from "@/components/public/LiveMentors";
import { MentorSearch } from "@/components/public/MentorSearch";
import { authMode } from "@/lib/auth-mode";
import { PageHero } from "@/components/public/kit";
import { Skeleton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Find a Mentor",
  description:
    "Browse verified mentors for assignments, practical khata, biology drawings and diagrams.",
};

export default function MentorsPage() {
  const live = authMode() === "wan";
  return (
    <>
      <PageHero
        title="Find a Mentor"
        sub="Mentors for every subject — compare ratings, verification and track record."
        crumbs={[{ label: "Mentors" }]}
      />
      <div className="container-x py-6">
        {live ? (
          <LiveMentors />
        ) : (
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
        )}
      </div>
    </>
  );
}
