import { fixtures } from "@edukhata/contracts";
import { LedgerTable } from "@/components/dash/finance";
import { PageHeader } from "@/components/ui";

export default function AccountantLedger() {
  return (
    <>
      <PageHeader
        title="Ledger"
        sub="Double-entry journal. Every transaction's debits equal its credits."
      />
      <LedgerTable entries={fixtures.ledger} />
    </>
  );
}
