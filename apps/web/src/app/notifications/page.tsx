import { redirect } from "next/navigation";
import { homeFor } from "@edukhata/contracts";
import { getSession } from "@/lib/session";

/** Area-independent link used by notifications and push messages. */
export default async function NotificationsRedirect() {
  const session = await getSession();
  if (!session) redirect("/login?next=/notifications");
  const home = homeFor(session.roles);
  redirect(home === "/onboarding" ? home : `${home}/notifications`);
}
