import { Suspense } from "react";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { LiveChat } from "@/components/dash/LiveChat";
import { Skeleton } from "@/components/ui";
import { apiFetch } from "@/lib/api";

/** Real chat (wan mode). Phase 3 rule: conversations with EduKhata support only. */
export async function LiveMessages() {
  const res = await apiFetch("/me");
  if (!res.ok) return <ApiProblem status={res.status} />;
  const me = (await res.json()) as { user: { id: string } };
  return (
    <Suspense fallback={<Skeleton className="h-[480px]" />}>
      <LiveChat userId={me.user.id} />
    </Suspense>
  );
}
