import type { FastifyPluginAsync } from "fastify";
import type { Deps } from "../deps.ts";
import { requireUser } from "../lib/session.ts";
import { acct, balance } from "../market/ledger.ts";

interface LineRow {
  id: string;
  txn_id: string;
  created_at: Date;
  account: string;
  amount_minor: string;
  memo: string;
  kind: string;
}
/** Contracts' LedgerEntry: debit/credit columns instead of signed amounts. */
const line = (r: LineRow) => {
  const a = Number(r.amount_minor);
  return {
    id: r.id,
    txId: r.txn_id,
    at: r.created_at.toISOString(),
    account: r.account,
    debitMinor: a > 0 ? a : 0,
    creditMinor: a < 0 ? -a : 0,
    memo: r.memo,
    kind: r.kind,
  };
};
const LINES = `select e.id, e.txn_id, e.created_at, e.account, e.amount_minor, t.memo, t.kind
  from ledger_entries e join ledger_transactions t on t.id = e.txn_id`;

export const ledgerRoutes: FastifyPluginAsync<Deps> = async (app, { db, config, hub }) => {
  /** A mentor's earnings: pending (approved, not yet closed) and available (can be paid out). */
  app.get("/mentor/earnings", async (req) => {
    const s = await requireUser(db, config, hub, req, "/mentor");
    const [pending, available] = await Promise.all([
      balance(db, acct.pending(s.user.id)),
      balance(db, acct.available(s.user.id)),
    ]);
    const rows = (
      await db.query<LineRow>(
        `${LINES} where e.account = any($1::text[]) order by e.id desc limit 100`,
        [[acct.pending(s.user.id), acct.available(s.user.id)]],
      )
    ).rows;
    return {
      currency: "BDT",
      // Liabilities to the mentor are credit balances.
      pendingMinor: -pending,
      availableMinor: -available,
      lines: rows.map(line),
    };
  });

  app.get<{ Querystring: { account?: string; limit?: string } }>(
    "/accountant/ledger",
    async (req) => {
      await requireUser(db, config, hub, req, "/accountant");
      const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 200)));
      const rows = (
        await db.query<LineRow>(
          `${LINES} where ($1::text is null or e.account like $1 || '%') order by e.id desc limit $2`,
          [req.query.account ?? null, limit],
        )
      ).rows;
      return rows.map(line);
    },
  );

  /** Balances by kind of account, and the trial balance (always 0). */
  app.get("/accountant/balances", async (req) => {
    await requireUser(db, config, hub, req, "/accountant");
    const rows = (
      await db.query<{ account: string; b: string }>(
        "select account, sum(amount_minor) as b from ledger_entries group by account",
      )
    ).rows;
    const sum = (pred: (a: string) => boolean) =>
      rows.filter((r) => pred(r.account)).reduce((a, r) => a + Number(r.b), 0);
    const names = new Map(
      (
        await db.query<{ id: string; name: string; number: string }>(
          "select id, name, number from payment_accounts",
        )
      ).rows.map((a) => [`cash:${a.id}`, `${a.name} (${a.number})`]),
    );
    return {
      currency: "BDT",
      cash: rows
        .filter((r) => r.account.startsWith("cash:"))
        .map((r) => ({
          account: r.account,
          name: names.get(r.account) ?? r.account,
          balanceMinor: Number(r.b),
        })),
      cashTotalMinor: sum((a) => a.startsWith("cash:")),
      heldForOrdersMinor: -sum((a) => a.startsWith("escrow:")),
      mentorPendingMinor: -sum((a) => a.endsWith(":pending")),
      mentorAvailableMinor: -sum((a) => a.endsWith(":available")),
      commissionMinor: -sum((a) => a === acct.commission),
      refundsPayableMinor: -sum((a) => a === acct.refunds),
      payoutsPayableMinor: -sum((a) => a === acct.payouts),
      trialBalanceMinor: sum(() => true),
    };
  });
};
