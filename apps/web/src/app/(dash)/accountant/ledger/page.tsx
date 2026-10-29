import { fixtures, type LedgerEntry } from "@edukhata/contracts";
import { ApiProblem } from "@/components/dash/ApiProblem";
import { LedgerTable } from "@/components/dash/finance";
import { PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { authMode } from "@/lib/auth-mode";

export default async function AccountantLedger() {
  const res = authMode() === "wan" ? await apiFetch("/accountant/ledger?limit=500") : null;
  if (res && !res.ok) return <ApiProblem status={res.status} />;
  return (
    <>
      <PageHeader
        title="Ledger"
        sub="Double-entry journal. Every transaction's debits equal its credits; entries are never edited."
      />
      <LedgerTable entries={res ? ((await res.json()) as LedgerEntry[]) : fixtures.ledger} />
    </>
  );
}
