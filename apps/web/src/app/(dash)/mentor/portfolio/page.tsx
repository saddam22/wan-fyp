import { fixtures } from "@edukhata/contracts";
import { PortfolioManager } from "@/components/dash/mentor";
import { PageHeader } from "@/components/ui";

export default function MentorPortfolio() {
  return (
    <>
      <PageHeader
        title="Portfolio"
        sub="Handwriting samples, practical khata pages, drawings and diagrams. Shown watermarked on your public profile."
      />
      <PortfolioManager items={fixtures.portfolio} />
    </>
  );
}
