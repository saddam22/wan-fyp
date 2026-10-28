import { fixtures } from "@edukhata/contracts";
import { DeclinedNotice, OffersList } from "@/components/dash/mentor";
import { Card, CardHeader, PageHeader } from "@/components/ui";

export default function MentorOffers() {
  return (
    <>
      <PageHeader
        title="New Requests"
        sub="Orders matched to your subjects, availability and capacity."
      />
      <Card>
        <CardHeader
          title={`${fixtures.offers.length} open offers`}
          sub="Offer for EK-24539 simulates another mentor accepting first."
        />
        <OffersList offers={fixtures.offers} />
        <div className="border-t border-line p-4">
          <DeclinedNotice />
        </div>
      </Card>
    </>
  );
}
