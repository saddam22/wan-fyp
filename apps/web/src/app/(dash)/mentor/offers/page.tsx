import type { Offer } from "@edukhata/contracts";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";
import { fixtures } from "@edukhata/contracts";
import { DeclinedNotice, OffersList } from "@/components/dash/mentor";
import { Card, CardHeader, PageHeader } from "@/components/ui";

export default async function MentorOffers() {
  if (authMode() === "wan") {
    const res = await apiFetch("/mentor/offers");
    if (!res.ok) return <ApiProblem status={res.status} />;
    const offers = (await res.json()) as (Offer & { instructions?: string })[];
    return (
      <>
        <PageHeader
          title="New Requests"
          sub="Orders matched to your subjects, availability and capacity. The first mentor to accept gets the order."
        />
        <Card>
          <CardHeader title={`${offers.length} open offers`} />
          <OffersList offers={offers} live />
        </Card>
      </>
    );
  }
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
