"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Lock, UserCog, X } from "lucide-react";
import { formatDate, ROLE_LABEL, type Role } from "@edukhata/contracts";
import { Avatar, Badge, Button, Card, EmptyState, Field } from "@/components/ui";
import { DataTable, Modal, useToast } from "@/components/ui/client";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

/** Users as returned by the EduKhata API (GET /api/admin/users). */
export interface LiveUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: "active" | "suspended";
  roles: Role[];
  createdAt: string;
  lastLoginAt: string | null;
}

export interface LiveAccessRequest {
  id: string;
  sub: string;
  name: string;
  username: string;
  roleName: string;
  reason: string;
  status: string;
  createdAt: string;
}

export interface LiveAuditEntry {
  id: string;
  at: string;
  action: string;
  target: string;
  actor: string | null;
  ip: string;
  details: Record<string, unknown> | null;
}

const STAFF: Role[] = ["supporter", "accountant", "admin", "super_admin"];
const ALL: Role[] = ["student", "guardian", "mentor", ...STAFF];

async function call(path: string, method: string, body: object) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? `Error ${res.status}`);
  return json;
}

/** Real role and status management. The API enforces every rule; the UI only mirrors them. */
export function LiveUsersTable({
  users: initial,
  canGrantStaff,
  meId,
}: {
  users: LiveUser[];
  canGrantStaff: boolean;
  meId?: string;
}) {
  const { lang } = useT();
  const toast = useToast();
  const router = useRouter();
  const [users, setUsers] = useState(initial);
  const [edit, setEdit] = useState<LiveUser | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [busy, setBusy] = useState(false);
  const [suspend, setSuspend] = useState<LiveUser | null>(null);
  const [reason, setReason] = useState("");

  const replace = (u: LiveUser) => setUsers((us) => us.map((x) => (x.id === u.id ? u : x)));
  const run = async (fn: () => Promise<LiveUser>, ok: string) => {
    setBusy(true);
    try {
      replace(await fn());
      toast({ tone: "success", title: ok });
      router.refresh();
      return true;
    } catch (e) {
      toast({ tone: "danger", title: "Not saved", body: (e as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <DataTable
        rows={users}
        rowKey={(u) => u.id}
        searchText={(u) => `${u.name} ${u.email ?? ""} ${u.phone ?? ""}`}
        filters={{
          label: "Status",
          options: [
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
          ],
          test: (u, v) => u.status === v,
        }}
        empty={{ title: "No users yet", body: "People appear here after their first WAN sign-in." }}
        columns={[
          {
            key: "n",
            header: "User",
            cell: (u) => (
              <span className="flex items-center gap-2.5">
                <Avatar name={u.name} hue={u.name.length * 23} size={32} />
                <span>
                  <span className="block font-semibold">
                    {u.name}
                    {u.id === meId && <span className="ml-1 text-xs text-muted">(you)</span>}
                  </span>
                  <span className="text-[11px] text-muted">{u.email ?? u.phone ?? "—"}</span>
                </span>
              </span>
            ),
            sort: (u) => u.name,
          },
          {
            key: "r",
            header: "Roles",
            cell: (u) =>
              u.roles.length ? (
                <span className="flex flex-wrap gap-1">
                  {u.roles.map((r) => (
                    <Badge key={r} tone={STAFF.includes(r) ? "violet" : "blue"}>
                      {ROLE_LABEL[r]}
                    </Badge>
                  ))}
                </span>
              ) : (
                <span className="text-xs text-muted">Onboarding</span>
              ),
          },
          {
            key: "s",
            header: "Status",
            cell: (u) => <Badge tone={u.status === "active" ? "green" : "red"}>{u.status}</Badge>,
          },
          {
            key: "j",
            header: "Joined",
            cell: (u) => formatDate(u.createdAt, lang),
            sort: (u) => u.createdAt,
          },
          {
            key: "l",
            header: "Last sign-in",
            cell: (u) => (u.lastLoginAt ? formatDate(u.lastLoginAt, lang, true) : "—"),
            sort: (u) => u.lastLoginAt ?? "",
          },
          {
            key: "a",
            header: "",
            cell: (u) => (
              <span className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  data-testid={`roles-${u.id}`}
                  onClick={(e) => (e.stopPropagation(), setEdit(u), setRoles(u.roles))}
                >
                  <UserCog size={14} /> Roles
                </Button>
                {u.id !== meId && (
                  <Button
                    size="sm"
                    variant={u.status === "suspended" ? "success" : "ghost"}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (u.status === "suspended") {
                        void run(
                          () => call(`/admin/users/${u.id}/status`, "POST", { status: "active" }),
                          `${u.name} reactivated`,
                        );
                      } else {
                        setSuspend(u);
                        setReason("");
                      }
                    }}
                  >
                    {u.status === "suspended" ? "Reactivate" : "Suspend"}
                  </Button>
                )}
              </span>
            ),
          },
        ]}
      />
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={`Marketplace roles — ${edit?.name}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={busy}
              onClick={async () =>
                (await run(
                  () => call(`/admin/users/${edit!.id}/roles`, "PUT", { roles }),
                  "Roles updated",
                )) && setEdit(null)
              }
            >
              Save roles
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          Roles are EduKhata-only. Signing in with WAN ID never grants them. The server re-checks
          every rule.
        </p>
        <ul className="space-y-2">
          {ALL.map((r) => {
            const allowed = canGrantStaff || !STAFF.includes(r);
            return (
              <li key={r}>
                <label
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-line p-2.5 text-sm",
                    !allowed && "opacity-50",
                  )}
                >
                  <input
                    type="checkbox"
                    disabled={!allowed}
                    checked={roles.includes(r)}
                    onChange={(e) =>
                      setRoles(e.target.checked ? [...roles, r] : roles.filter((x) => x !== r))
                    }
                    className="accent-[var(--color-accent)]"
                  />
                  <span className="flex-1 font-semibold">{ROLE_LABEL[r]}</span>
                  {!allowed && (
                    <span className="flex items-center gap-1 text-[11px] text-muted">
                      <Lock size={12} /> Super admin only
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </Modal>
      <Modal
        open={!!suspend}
        onClose={() => setSuspend(null)}
        title={`Suspend ${suspend?.name}?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setSuspend(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () =>
                (await run(
                  () =>
                    call(`/admin/users/${suspend!.id}/status`, "POST", {
                      status: "suspended",
                      reason,
                    }),
                  `${suspend!.name} suspended`,
                )) && setSuspend(null)
              }
            >
              Suspend
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-700">
          They are signed out of EduKhata immediately and can&apos;t sign in until reactivated.
        </p>
        <Field label="Reason (kept in the audit log)" htmlFor="sus-r">
          <input
            id="sus-r"
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
          />
        </Field>
      </Modal>
    </Card>
  );
}

/** Access requests made for EduKhata in WAN Identity Hub. Deciding here writes back to the hub. */
export function LiveAccessRequests({ requests: initial }: { requests: LiveAccessRequest[] }) {
  const { lang } = useT();
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const decide = async (r: LiveAccessRequest, approve: boolean) => {
    try {
      await call(`/admin/access-requests/${r.id}/decision`, "POST", { approve });
      setRows((xs) => xs.filter((x) => x.id !== r.id));
      toast({
        tone: "success",
        title: approve ? `${r.name} can use EduKhata` : `Request from ${r.name} declined`,
        body: "Recorded in WAN Identity Hub; the person is notified.",
      });
    } catch (e) {
      toast({ tone: "danger", title: "Not saved", body: (e as Error).message });
    }
  };
  if (rows.length === 0)
    return (
      <Card>
        <EmptyState
          title="No pending requests"
          body="People whose EduKhata access was suspended or declined can ask again in WAN Identity Hub. Their requests appear here."
        />
      </Card>
    );
  return (
    <Card>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <Avatar name={r.name} hue={r.name.length * 19} size={36} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {r.name} <span className="font-normal text-muted">@{r.username}</span>
              </p>
              <p className="text-slate-700">“{r.reason}”</p>
              <p className="text-[11px] text-muted">
                {r.roleName} · {formatDate(r.createdAt, lang, true)}
              </p>
            </div>
            <Button size="sm" variant="success" onClick={() => decide(r, true)}>
              <Check size={14} /> Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => decide(r, false)}>
              <X size={14} /> Decline
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function LiveAuditTable({ entries }: { entries: LiveAuditEntry[] }) {
  const { lang } = useT();
  return (
    <Card>
      <DataTable
        rows={entries}
        rowKey={(e) => e.id}
        searchText={(e) => `${e.actor ?? ""} ${e.action} ${e.target}`}
        empty={{ title: "Nothing logged yet" }}
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
            cell: (e) => e.actor ?? <span className="text-muted">system</span>,
          },
          {
            key: "x",
            header: "Action",
            cell: (e) => <span className="font-mono text-xs">{e.action}</span>,
          },
          {
            key: "g",
            header: "Details",
            cell: (e) => (
              <span className="text-xs text-muted">
                {e.details ? JSON.stringify(e.details) : e.target}
              </span>
            ),
          },
          {
            key: "i",
            header: "IP",
            cell: (e) => <span className="font-mono text-xs text-muted">{e.ip}</span>,
          },
        ]}
      />
    </Card>
  );
}
