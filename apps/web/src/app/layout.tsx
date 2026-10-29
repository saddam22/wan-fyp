import type { Metadata, Viewport } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/hind-siliguri/bengali-400.css";
import "@fontsource/hind-siliguri/bengali-600.css";
import "./globals.css";
import { DemoBanner } from "@/components/DemoBanner";
import { ToastProvider } from "@/components/ui/client";
import { LangProvider } from "@/lib/i18n/client";
import { getLang } from "@/lib/i18n/server";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "EduKhata — Assignment & Practical Khata Marketplace",
    template: "%s · EduKhata",
  },
  description:
    "Order assignments, handwritten practical khata, biology drawings and diagrams from verified mentors. Free revisions, secure payment, Bangladesh first.",
  applicationName: "EduKhata",
  openGraph: { type: "website", siteName: "EduKhata", locale: "en_BD", alternateLocale: ["bn_BD"] },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#1d4ed8", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body>
        <LangProvider lang={lang}>
          <ToastProvider>
            <DemoBanner />
            {children}
          </ToastProvider>
        </LangProvider>
      </body>
    </html>
  );
}
