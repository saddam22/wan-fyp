import { Heart } from "lucide-react";
import { fixtures } from "@edukhata/contracts";
import { MentorCard } from "@/components/public/MentorCard";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";

export default function StudentFavorites() {
  const favs = fixtures.mentors.filter((m) => ["m1", "m3", "m5"].includes(m.id));
  return (
    <>
      <PageHeader title="Favorite Mentors" sub="Mentors you saved — order from them directly." />
      {favs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Heart size={22} />}
            title="No favourites yet"
            body="Tap the heart on any mentor card to save them here."
            action={<ButtonLink href="/mentors">Find mentors</ButtonLink>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {favs.map((m) => (
            <MentorCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </>
  );
}
