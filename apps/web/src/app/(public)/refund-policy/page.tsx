import type { Metadata } from "next";
import { LegalPage } from "@/components/public/kit";

export const metadata: Metadata = { title: "Refund Policy" };

export default function RefundPage() {
  return (
    <LegalPage title="Refund Policy" updated="28 Oct 2026">
      <ul>
        <li>
          <b>Before a mentor accepts:</b> full refund on cancellation.
        </li>
        <li>
          <b>No mentor accepts</b> within the matching window: full refund, or choose to wait.
        </li>
        <li>
          <b>After delivery:</b> refunds only through a dispute decision (full, partial or none).
        </li>
        <li>
          <b>Rejected payments</b> (TrxID not found) are not charged; resubmit the correct
          transaction ID.
        </li>
      </ul>
      <p>
        Refunds go back to the original method (bKash, Nagad, Rocket or bank). Exact timelines and
        partial-refund rules are being finalised and will be shown here before launch.
      </p>
    </LegalPage>
  );
}
