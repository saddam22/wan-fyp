"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, type ReactNode } from "react";
import { LocalHubProvider, type LinkProps } from "@local-hub/ui";
import { useT } from "@/lib/i18n/client";

/** No token: the session cookie travels with every same-origin request. Must be stable. */
const noToken = () => null;

const NextLink = ({ href, children, ...rest }: LinkProps) => (
  <Link href={href} {...rest}>
    {children}
  </Link>
);

/**
 * The jobs board (marketplace-jobs module) inside EduKhata: its API is mounted at
 * /api/local and uses EduKhata's session cookie, so no token is handed to the browser.
 */
export function JobsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { lang } = useT();
  const navigate = useCallback((href: string) => router.push(href), [router]);
  return (
    <LocalHubProvider
      baseUrl="/api/local"
      getAccessToken={noToken}
      Link={NextLink}
      navigate={navigate}
      signInHref="/login?next=/jobs"
      locale={lang}
    >
      {children}
    </LocalHubProvider>
  );
}
