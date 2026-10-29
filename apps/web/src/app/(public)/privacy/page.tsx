import type { Metadata } from "next";
import { LegalPage } from "@/components/public/kit";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="28 Oct 2026">
      <p>
        This policy explains what EduKhata collects and why. EduKhata is part of the WANBAHJAHKAS
        ecosystem; your account (name, email, phone, password, two-factor settings) is held by WAN
        Identity Hub. EduKhata receives only what it needs when you sign in.
      </p>
      <h2>What we store</h2>
      <ul>
        <li>Marketplace profile: role, class, institution, subjects, mentor qualifications.</li>
        <li>Orders: requirements, files, messages, deliveries, revisions, reviews.</li>
        <li>Payments: amount, method, sender number, transaction ID and optional proof image.</li>
        <li>
          Verification documents (mentors): stored privately, visible only to the verification team.
        </li>
      </ul>
      <h2>Who can see it</h2>
      <ul>
        <li>
          Order files and chat: you, the assigned mentor, and support/admin staff handling your
          order.
        </li>
        <li>Payment details: you, linked guardians you allow, and the accounts team.</li>
        <li>Guardians see only what the student permits.</li>
      </ul>
      <h2>Advertising</h2>
      <p>
        Ads are contextual (based on the page, not on you) and are always labelled. We do not send
        personal data to advertisers.
      </p>
      <h2>Calls</h2>
      <p>Audio/video calls are not recorded.</p>
      <h2>Retention and your rights</h2>
      <p>
        Retention periods, data export and deletion requests will be finalised before launch.
        Contact support to exercise your rights.
      </p>
    </LegalPage>
  );
}
