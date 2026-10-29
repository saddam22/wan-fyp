"use client";

import { formatDate, ROLE_LABEL, type AuditEntry } from "@edukhata/contracts";
import { Badge, Card } from "@/components/ui";
import { DataTable } from "@/components/ui/client";
import { useT } from "@/lib/i18n/client";

export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  const { lang } = useT();
  return (
    <Card>
      <DataTable
        rows={entries}
        rowKey={(e) => e.id}
        searchText={(e) => `${e.actor} ${e.action} ${e.target}`}
        filters={{
          label: "Action",
          options: [...new Set(entries.map((e) => e.action.split(".")[0]!))].map((v) => ({
            value: v,
            label: v,
          })),
          test: (e, v) => e.action.startsWith(v),
        }}
        columns={[
          {
            key: "t",
            header: "When",
            cell: (e) => formatDate(e.at, lang, true),
            sort: (e) => e.at,
          },
          {
            key: "a",
            header: "Actor",
            cell: (e) => (
              <span>
                <span className="block font-semibold">{e.actor}</span>
                <Badge>{ROLE_LABEL[e.role]}</Badge>
              </span>
            ),
          },
          {
            key: "x",
            header: "Action",
            cell: (e) => <span className="font-mono text-xs">{e.action}</span>,
          },
          { key: "g", header: "Target", cell: (e) => e.target },
          {
            key: "i",
            header: "IP",
            cell: (e) => <span className="font-mono text-xs text-muted">{e.ip}</span>,
          },
        ]}
      />
      <p className="border-t border-line px-4 py-2.5 text-[11px] text-muted">
        Append-only. In production each entry is hash-chained to the previous one (pattern from the
        WAN ad platform) so edits are detectable.
      </p>
    </Card>
  );
}
