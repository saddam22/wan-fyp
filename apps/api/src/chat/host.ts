import type { ChatHost } from "@chat-module/server";
import type { Role } from "@edukhata/contracts";
import type { Db } from "../db.ts";
import type { ChatTokens } from "./tokens.ts";

/** EduKhata staff. Anyone may talk to staff; staff may talk to anyone. */
export const CHAT_STAFF: Role[] = ["supporter", "accountant", "admin", "super_admin"];

interface Row {
  id: string;
  name: string;
  status: string;
  roles: Role[];
}

const summary = (r: Row) => ({
  id: r.id,
  displayName: r.name,
  // No handles, emails or phone numbers in chat: contact details stay private.
  handle: null,
  avatarUrl: null,
  status: r.status === "active" ? ("active" as const) : ("suspended" as const),
});

const USERS_SQL = `select u.id, u.name, u.status, coalesce(array_agg(r.role) filter (where r.role is not null), '{}') as roles
  from users u left join user_roles r on r.user_id = u.id`;

/**
 * Verifies a chat/call token and the EduKhata session behind it: not revoked, not
 * expired, not idle, user active and onboarded (people without a role can't chat or call).
 */
export function sessionTokenAuth(db: Db, tokens: ChatTokens) {
  return async (token: string) => {
    const t = tokens.verify(token);
    if (!t) return null;
    const r = (
      await db.query<{ user_id: string }>(
        `select s.user_id from sessions s join users u on u.id = s.user_id
          where s.id::text = $1 and s.revoked_at is null and s.expires_at > now()
            and s.last_seen_at > now() - interval '12 hours' and u.status = 'active'
            and exists (select 1 from user_roles r where r.user_id = u.id)`,
        [t.sessionId],
      )
    ).rows[0];
    return r ? { userId: r.user_id, expiresAt: t.expiresAt } : null;
  };
}

/** True when one of the two people is EduKhata staff (the Phase 3 contact rule). */
export async function involvesStaff(db: Db, a: string, b: string): Promise<boolean> {
  const r = await db.query(
    "select 1 from user_roles where user_id = any($1::uuid[]) and role = any($2::text[]) limit 1",
    [[a, b], CHAT_STAFF],
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * The chat module's view of EduKhata: identity from EduKhata sessions, names from the
 * users table, and the marketplace rule for who may message whom.
 *
 * Phase 3 rule: a direct chat needs EduKhata staff on one side (support, payments,
 * admin). Student ↔ mentor chats open per order in Phase 4, so contact details and
 * deals stay on the platform. Group chats are off (features.groups = false).
 */
export function edukhataChatHost(db: Db, tokens: ChatTokens): ChatHost {
  const load = async (ids: readonly string[]) =>
    (await db.query<Row>(`${USERS_SQL} where u.id = any($1::uuid[]) group by u.id`, [ids])).rows;
  const isStaff = (r: Row | undefined) => !!r && r.roles.some((x) => CHAT_STAFF.includes(x));

  return {
    authenticate: sessionTokenAuth(db, tokens),

    async getUsers(ids) {
      return (await load(ids)).map(summary);
    },

    async searchUsers(query, viewerId, limit) {
      const [viewer] = await load([viewerId]);
      const like = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      // Staff find anyone; everyone else finds the support team only.
      const rows = (
        await db.query<Row>(
          `${USERS_SQL} where u.status = 'active' and u.id <> $2 and u.name ilike $1
            group by u.id having ${
              isStaff(viewer) ? "count(r.role) > 0" : "bool_or(r.role = 'supporter')"
            } order by u.name limit $3`,
          [like, viewerId, limit],
        )
      ).rows;
      return rows.map(summary);
    },

    canStartDirect: (senderId, recipientId) => involvesStaff(db, senderId, recipientId),
  };
}
