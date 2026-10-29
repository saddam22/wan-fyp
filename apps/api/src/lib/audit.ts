import type { Queryable } from "../db.ts";

export async function audit(
  db: Queryable,
  e: { actorId: string | null; action: string; target?: string; details?: object; ip?: string },
): Promise<void> {
  await db.query(
    "insert into audit_log (actor_id, action, target, details, ip) values ($1, $2, $3, $4, $5)",
    [e.actorId, e.action, e.target ?? "", e.details ? JSON.stringify(e.details) : null, e.ip ?? ""],
  );
}
