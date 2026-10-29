import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, ShieldX } from "lucide-react";
import { buttonClass, Card } from "@/components/ui";
import { WAN_HUB_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Access needed", robots: { index: false } };

const TEXT: Record<string, { title: string; body: string }> = {
  denied: {
    title: "Your EduKhata access is not active",
    body: "WAN Identity Hub reports that your access to EduKhata is suspended or was declined. You can request access again in WAN Identity Hub; an EduKhata admin reviews it.",
  },
  suspended: {
    title: "Your EduKhata account is suspended",
    body: "An EduKhata admin suspended this account. Contact support if you think this is a mistake.",
  },
  failed: {
    title: "WAN sign-in did not finish",
    body: "The sign-in was cancelled or failed at WAN Identity Hub. Please try again.",
  },
};

export default async function AccessRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason = "denied" } = await searchParams;
  const t = TEXT[reason] ?? TEXT.denied!;
  return (
    <Card className="w-full max-w-lg p-8 text-center">
      <ShieldX size={44} className="mx-auto text-danger" />
      <h1 className="mt-3 text-xl font-extrabold">{t.title}</h1>
      <p className="mt-2 text-sm text-muted">{t.body}</p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        {reason === "denied" && (
          <a
            href={`${WAN_HUB_URL}/#/access-requests`}
            className={buttonClass("primary", "md")}
            target="_blank"
            rel="noreferrer"
          >
            Request access in WAN ID <ExternalLink size={14} />
          </a>
        )}
        {reason === "failed" && (
          <Link href="/login" className={buttonClass("primary", "md")}>
            Try again
          </Link>
        )}
        {reason === "suspended" && (
          <Link href="/contact" className={buttonClass("primary", "md")}>
            Contact support
          </Link>
        )}
        <Link href="/" className={buttonClass("outline", "md")}>
          Back to EduKhata
        </Link>
      </div>
    </Card>
  );
}
