import { ServerCrash } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";

export function ApiProblem({ status }: { status: number | string }) {
  return (
    <Card>
      <EmptyState
        icon={<ServerCrash size={22} />}
        title="Couldn't load this from the EduKhata API"
        body={`The API answered ${status}. Try again in a moment.`}
      />
    </Card>
  );
}
