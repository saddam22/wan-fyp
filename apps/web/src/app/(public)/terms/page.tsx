import type { Metadata } from "next";
import { LegalPage } from "@/components/public/kit";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" updated="28 Oct 2026">
      <h2>1. The service</h2>
      <p>
        EduKhata is a marketplace where students and guardians order assignments, handwritten
        practical khata, drawings, diagrams and project work from independent, verified mentors.
      </p>
      <h2>2. Academic integrity</h2>
      <p>
        Delivered work is provided as reference and learning material and as handwritten practical
        records prepared to your instructions. You are responsible for following your school,
        college or university rules on what you may submit. Institutions can report concerns through
        the Contact page.
      </p>
      <h2>3. Orders, revisions and approval</h2>
      <ul>
        <li>
          Each order includes the number of free revisions shown before payment (normally 2–3).
        </li>
        <li>
          If you neither approve nor request a revision within the review window, the order may be
          approved automatically.
        </li>
        <li>Only one mentor can be assigned to an order at a time.</li>
      </ul>
      <h2>4. Payments</h2>
      <p>
        You pay EduKhata. The mentor&apos;s share (currently 80%) is released after approval.
        Platform commission and fees are shown in the price.
      </p>
      <h2>5. Mentors</h2>
      <p>
        Mentors must provide accurate identity and qualification information, deliver original work,
        and keep communication on the platform.
      </p>
      <h2>6. Disputes</h2>
      <p>
        Either party may open a dispute. EduKhata staff review the order history, files and chat and
        decide on release, partial refund or full refund.
      </p>
      <h2>7. Prohibited</h2>
      <ul>
        <li>Sharing contact details to move payment off-platform.</li>
        <li>Plagiarised or copyrighted material without permission.</li>
        <li>Harassment or abuse in chat or calls.</li>
      </ul>
    </LegalPage>
  );
}
