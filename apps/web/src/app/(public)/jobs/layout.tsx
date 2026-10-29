import type { Metadata } from "next";
import { JobsProvider } from "@/components/jobs/JobsProvider";
import { PageHero } from "@/components/public/kit";
import { authMode } from "@/lib/auth-mode";

export const metadata: Metadata = {
  title: "Jobs & Tuition",
  description: "Tuition and teaching jobs from coaching centres, schools and families.",
};

/** Jobs and tuition board (marketplace-jobs module). Needs the live backend. */
export default function JobsLayout({ children }: { children: React.ReactNode }) {
  if (authMode() !== "wan")
    return (
      <PageHero
        title="Jobs & Tuition"
        sub="Tuition and teaching jobs from coaching centres, schools and families. Available on the live site with your WAN ID."
        crumbs={[{ label: "Jobs" }]}
      />
    );
  return (
    <div className="container-x py-6">
      <JobsProvider>{children}</JobsProvider>
    </div>
  );
}
