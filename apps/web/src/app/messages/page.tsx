import { redirect } from "next/navigation";
import { homeFor } from "@edukhata/contracts";
import { getSession } from "@/lib/session";

/** Where each area keeps its conversations. Areas without messaging land on their home. */
const INBOX: Record<string, string> = {
  "/student": "/student/messages",
  "/mentor": "/mentor/messages",
  "/admin": "/admin/messages",
  "/support-desk": "/support-desk/chat",
};

/** Area-independent link used by chat and missed-call notifications (/messages?c=<id>). */
export default async function MessagesRedirect({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const query = typeof c === "string" && c ? `?c=${encodeURIComponent(c)}` : "";
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/messages${query}`)}`);
  const home = homeFor(session.roles);
  // Staff without an inbox who also study use their student inbox.
  const inbox = INBOX[home] ?? (session.roles.includes("student") ? INBOX["/student"] : home);
  redirect(`${inbox}${query}`);
}
