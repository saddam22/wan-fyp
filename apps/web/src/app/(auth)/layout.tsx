import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LanguageSwitch } from "@/components/public/Header";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-30px)] flex-col bg-gradient-to-br from-brand-50 via-white to-amber-50">
      <header className="container-x flex h-16 items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4 text-sm">
          <LanguageSwitch />
          <Link href="/" className="font-semibold text-brand-600 hover:underline">
            ← Back to site
          </Link>
        </div>
      </header>
      <main id="main" className="container-x flex flex-1 items-center justify-center py-8">
        {children}
      </main>
    </div>
  );
}
