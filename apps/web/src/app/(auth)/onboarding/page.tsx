import type { Metadata } from "next";
import { OnboardingForm } from "@/components/OnboardingForm";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Complete your profile", robots: { index: false } };

export default function OnboardingPage() {
  return (
    <Card className="w-full max-w-2xl p-6 sm:p-8">
      <h1 className="text-xl font-extrabold">Welcome to EduKhata</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Your WAN ID is connected. Tell us a little about you to finish setting up — dashboards
        unlock after this step.
      </p>
      <OnboardingForm />
    </Card>
  );
}
