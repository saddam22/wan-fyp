import { NextResponse, type NextRequest } from "next/server";
import { REF_COOKIE, REF_DAYS, REF_PATTERN } from "@/lib/referral";

/**
 * Referral links (`/any-page?ref=CODE`): remember the code for 30 days so it can be
 * credited when the visitor joins EduKhata. The first link wins (ICTSpark's rule); the
 * API checks the code and decides at onboarding.
 */
export function proxy(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref");
  if (!ref || !REF_PATTERN.test(ref) || req.cookies.has(REF_COOKIE)) return NextResponse.next();
  const res = NextResponse.next();
  res.cookies.set(REF_COOKIE, ref.toUpperCase(), {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: REF_DAYS * 24 * 3600,
  });
  return res;
}

export const config = {
  // Pages only: not the API, Next internals or static files.
  matcher: ["/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml|.*\\.[a-z0-9]+$).*)"],
};
