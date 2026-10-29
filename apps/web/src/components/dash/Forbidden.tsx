import Link from "next/link";
import { Lock } from "lucide-react";
import { homeFor } from "@edukhata/contracts";
import { buttonClass, Card } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";

export async function Forbidden({ inline }: { inline?: boolean }) {
  const { t } = await getT();
  const session = await getSession();
  return (
    <Card
      data-testid="forbidden"
      className={
        inline ? "mx-auto mt-6 max-w-lg p-8 text-center" : "w-full max-w-lg p-8 text-center"
      }
    >
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-danger">
        <Lock size={26} />
      </span>
      <h1 className="mt-3 text-xl font-extrabold">{t.common.forbiddenTitle}</h1>
      <p className="mt-2 text-sm text-muted">{t.common.forbiddenBody}</p>
      <Link
        href={session ? homeFor(session.roles) : "/login"}
        className={buttonClass("primary", "md", "mt-5")}
      >
        {session ? t.common.goHome : t.header.login}
      </Link>
    </Card>
  );
}
