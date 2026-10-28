import type { Metadata } from "next";
import Link from "next/link";
import { Clock, ExternalLink, ShieldQuestion } from "lucide-react";
import { buttonClass, Card } from "@/components/ui";

export const metadata: Metadata = { title: "Request access", robots: { index: false } };

export default function AccessRequestPage() {
  return (
    <Card className="w-full max-w-lg p-8 text-center">
      <ShieldQuestion size={44} className="mx-auto text-brand-600" />
      <h1 className="mt-3 text-xl font-extrabold">EduKhata access needed</h1>
      <p className="mt-2 text-sm text-muted">
        You are signed in with your WAN ID, but your account doesn&apos;t have access to EduKhata
        yet. Students and guardians get access instantly; if your access is pending, it appears in
        WAN Identity Hub under <b>Access requests</b>.
      </p>
      <div className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        <Clock size={16} /> Status: <b>pending review</b> (demo)
      </div>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <span
          className={buttonClass("primary", "md", "opacity-60")}
          title="Links to the hub in Phase 2"
        >
          Open WAN Identity Hub <ExternalLink size={14} />
        </span>
        <Link href="/" className={buttonClass("outline", "md")}>
          Back to EduKhata
        </Link>
      </div>
    </Card>
  );
}
