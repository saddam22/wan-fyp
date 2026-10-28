import { FlaskConical } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { DEMO_MODE } from "@/lib/site";

export async function DemoBanner() {
  if (!DEMO_MODE) return null;
  const { t } = await getT();
  return (
    <div
      data-testid="demo-banner"
      className="bg-amber-400 px-4 py-1.5 text-center text-xs font-semibold text-amber-950"
    >
      <FlaskConical size={13} className="mr-1 inline -translate-y-px" />
      {t.demo.banner}
    </div>
  );
}
