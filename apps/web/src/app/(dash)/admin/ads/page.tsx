import { AdsConfig } from "@/components/dash/admin-content";
import { PageHeader } from "@/components/ui";

export default function AdminAds() {
  return (
    <>
      <PageHeader
        title="Advertising"
        sub="Sponsored placements served by the WAN Central Ad Platform."
      />
      <AdsConfig />
    </>
  );
}
