import { fixtures } from "@edukhata/contracts";
import { ServicesManager } from "@/components/dash/mentor";
import { PageHeader } from "@/components/ui";

export default function MentorServices() {
  return (
    <>
      <PageHeader
        title="Services & Pricing"
        sub="What you offer, at what price, with optional discounts."
      />
      <ServicesManager services={fixtures.services} />
    </>
  );
}
