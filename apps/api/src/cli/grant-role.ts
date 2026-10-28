/**
 * Bootstrap: grant a marketplace role to someone who has signed in once with WAN ID.
 *   pnpm --filter @edukhata/api grant-role <email | phone | WAN sub> super_admin
 * The first super admin can only be created this way (server access required).
 */
import { loadConfig } from "../config.ts";
import { createDb } from "../db.ts";
import { audit } from "../lib/audit.ts";

const ROLES = ["student", "guardian", "mentor", "supporter", "accountant", "admin", "super_admin"];
const [who, role] = process.argv.slice(2);
if (!who || !role || !ROLES.includes(role)) {
  console.error(`Usage: grant-role <email|phone|sub> <${ROLES.join("|")}>`);
  process.exit(2);
}
const db = createDb(loadConfig().databaseUrl);
const user = (
  await db.query<{ id: string; name: string }>(
    "select id, name from users where email = $1 or phone = $1 or wan_sub = $1",
    [who],
  )
).rows[0];
if (!user) {
  console.error("No such user. They must sign in to EduKhata with their WAN ID once first.");
  process.exit(1);
}
await db.query("insert into user_roles (user_id, role) values ($1, $2) on conflict do nothing", [
  user.id,
  role,
]);
await audit(db, {
  actorId: null,
  action: "user.roles.cli",
  target: user.id,
  details: { added: [role] },
});
console.log(`Granted ${role} to ${user.name}`);
await db.end();
