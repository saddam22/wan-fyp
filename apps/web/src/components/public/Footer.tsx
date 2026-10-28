import Link from "next/link";
import { Camera, Mail, MapPin, Phone, Play } from "lucide-react";
import { fixtures } from "@edukhata/contracts";
import { Logo } from "@/components/Logo";
import { getT } from "@/lib/i18n/server";
import { NewsletterForm } from "./NewsletterForm";

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M18.9 2H22l-7.2 8.2L23 22h-6.6l-5.2-6.8L5.3 22H2.2l7.7-8.8L1.8 2h6.7l4.7 6.2Zm-1.1 18h1.7L7.3 3.9H5.5Z" />
    </svg>
  );
}
/** lucide-react 1.x ships no brand logos; these are simple neutral glyphs. */
function Glyph({ children }: { children: string }) {
  return <span className="text-[13px] leading-none font-extrabold">{children}</span>;
}
function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M16.6 2h-3.3v13.2a2.9 2.9 0 1 1-2-2.8V9a6.3 6.3 0 1 0 5.3 6.2V8.6a7.9 7.9 0 0 0 4.4 1.4V6.7a4.5 4.5 0 0 1-4.4-4.7Z" />
    </svg>
  );
}

export async function Footer() {
  const { t } = await getT();
  const cols: { title: string; links: [string, string][] }[] = [
    {
      title: t.footer.quickLinks,
      links: [
        [t.footer.aboutUs, "/about"],
        [t.nav.howItWorks, "/how-it-works"],
        [t.nav.pricing, "/pricing"],
        [t.nav.mentors, "/mentors"],
        [t.header.becomeMentor, "/become-a-mentor"],
        [t.nav.blog, "/blog"],
      ],
    },
    {
      title: t.footer.categories,
      links: fixtures.categories.slice(0, 6).map((c) => [c.name, `/assignments/${c.slug}`]),
    },
    {
      title: t.footer.support,
      links: [
        [t.footer.helpCenter, "/faq"],
        [t.nav.contact, "/contact"],
        [t.footer.terms, "/terms"],
        [t.footer.privacy, "/privacy"],
        [t.footer.refund, "/refund-policy"],
      ],
    },
  ];
  const socials = [
    { label: "Facebook", icon: <Glyph>f</Glyph>, bg: "bg-[#1877f2]" },
    { label: "YouTube", icon: <Play size={14} className="fill-current" />, bg: "bg-[#ff0000]" },
    { label: "LinkedIn", icon: <Glyph>in</Glyph>, bg: "bg-[#0a66c2]" },
    {
      label: "Instagram",
      icon: <Camera size={15} />,
      bg: "bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]",
    },
    { label: "TikTok", icon: <TikTokIcon />, bg: "bg-black" },
    { label: "X", icon: <XIcon />, bg: "bg-black" },
  ];
  return (
    <footer className="mt-12 bg-navy text-blue-100">
      <div className="container-x grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.4fr]">
        <div className="space-y-3">
          <Logo light tagline={t.brand.tagline} />
          <p className="max-w-xs text-sm text-blue-200">{t.footer.about}</p>
          <ul className="space-y-1.5 text-sm text-blue-200">
            <li className="flex items-center gap-2">
              <MapPin size={14} /> Dhaka, Bangladesh
            </li>
            <li className="flex items-center gap-2">
              <Mail size={14} /> support@edukhata.example
            </li>
            <li className="flex items-center gap-2">
              <Phone size={14} /> +880 9XXX-XXXXXX
            </li>
          </ul>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h3 className="mb-3 text-sm font-bold text-white">{c.title}</h3>
            <ul className="space-y-2 text-sm">
              {c.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-blue-200 hover:text-white hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="space-y-4">
          <div>
            <h3 className="mb-3 text-sm font-bold text-white">{t.footer.stayConnected}</h3>
            <ul className="flex flex-wrap gap-2">
              {socials.map((s) => (
                <li key={s.label}>
                  <span
                    title={`${s.label} (link set by admin)`}
                    aria-label={s.label}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${s.bg}`}
                  >
                    {s.icon}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{t.footer.newsletter}</h3>
            <p className="mb-2 text-xs text-blue-200">{t.footer.newsletterSub}</p>
            <NewsletterForm placeholder={t.footer.emailPlaceholder} label={t.footer.subscribe} />
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-4 text-xs text-blue-200 sm:flex-row">
          <p>
            © {new Date().getFullYear()} EduKhata. {t.footer.rights} · {t.footer.partOf}
          </p>
          <p className="flex items-center gap-2">
            <span>🇧🇩 Bangladesh</span>|<span>{t.common.language}: English / বাংলা</span>|
            <span>BDT ৳</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
