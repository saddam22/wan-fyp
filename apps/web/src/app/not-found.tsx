import Link from "next/link";
import { SearchX } from "lucide-react";
import { Logo } from "@/components/Logo";
import { buttonClass } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <SearchX size={48} className="text-muted" />
      <h1 className="text-2xl font-extrabold">{t.common.notFound}</h1>
      <p className="max-w-sm text-muted">{t.common.notFoundBody}</p>
      <div className="flex gap-2">
        <Link href="/" className={buttonClass("primary", "md")}>
          {t.nav.home}
        </Link>
        <Link href="/mentors" className={buttonClass("outline", "md")}>
          {t.nav.mentors}
        </Link>
      </div>
    </main>
  );
}
