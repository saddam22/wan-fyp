import Link from "next/link";

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <defs>
        <linearGradient id="ek-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
      <path d="M20 4 37 12 20 20 3 12Z" fill="url(#ek-g)" />
      <path d="M9 16v8c0 3 5 6 11 6s11-3 11-6v-8l-11 5Z" fill="#1d4ed8" opacity=".85" />
      <path d="M8 31c4-2 8-2 12 0 4-2 8-2 12 0v4c-4-2-8-2-12 0-4-2-8-2-12 0Z" fill="#f59e0b" />
      <path d="M35 13v9" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({
  tagline,
  light,
  href = "/",
}: {
  tagline?: string;
  light?: boolean;
  href?: string;
}) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2" aria-label="EduKhata home">
      <LogoMark />
      <span className="leading-none">
        <span
          className={`block text-[22px] font-extrabold tracking-tight ${light ? "text-white" : "text-navy"}`}
        >
          Edu<span className={light ? "text-amber-300" : "text-brand-600"}>Khata</span>
        </span>
        {tagline && (
          <span
            className={`mt-0.5 hidden text-[9.5px] font-medium sm:block ${light ? "text-blue-100" : "text-muted"}`}
          >
            {tagline}
          </span>
        )}
      </span>
    </Link>
  );
}
