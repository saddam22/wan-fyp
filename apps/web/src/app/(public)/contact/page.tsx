import type { Metadata } from "next";
import { Clock, Mail, MessageCircle, Phone } from "lucide-react";
import { ContactForm } from "@/components/public/ContactForm";
import { authMode } from "@/lib/auth-mode";
import { PageHero } from "@/components/public/kit";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Contact Us" };

export default function ContactPage() {
  return (
    <>
      <PageHero
        title="Contact Us"
        sub="Questions about an order, payment or becoming a mentor? We're here to help."
        crumbs={[{ label: "Contact" }]}
      />
      <div className="container-x grid gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">Send us a message</h2>
          <ContactForm live={authMode() === "wan"} />
        </Card>
        <div className="space-y-3">
          {[
            [MessageCircle, "Live chat", "Signed-in users: Support chat in your dashboard"],
            [Mail, "Email", "support@edukhata.example"],
            [Phone, "Phone", "+880 9XXX-XXXXXX (set by admin)"],
            [Clock, "Hours", "Every day, 9 am – 11 pm (Dhaka)"],
          ].map(([Icon, t, b]) => {
            const I = Icon as typeof Mail;
            return (
              <Card key={t as string} className="flex gap-3 p-4">
                <I size={20} className="text-brand-600" />
                <div>
                  <p className="font-semibold">{t as string}</p>
                  <p className="text-sm text-muted">{b as string}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
