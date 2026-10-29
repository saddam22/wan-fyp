"use client";

import { useState } from "react";
import { BadgeCheck, Eye, FileText, Lock, ShieldCheck, UserCog } from "lucide-react";
import {
  fixtures,
  formatDate,
  ROLE_LABEL,
  type MentorApplication,
  type Role,
  type UserRow,
} from "@edukhata/contracts";
import { Avatar, Badge, Button, Card, CardHeader, Field, KeyValue } from "@/components/ui";
import { DataTable, Modal, Tabs, useToast } from "@/components/ui/client";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { subjectName } from "@/lib/labels";

const STAFF_ROLES: Role[] = ["supporter", "accountant", "admin", "super_admin"];

export function UsersTable({
  users: initial,
  canGrantStaff,
  only,
}: {
  users: UserRow[];
  canGrantStaff: boolean;
  only?: Role;
}) {
  const { lang } = useT();
  const toast = useToast();
  const [users, setUsers] = useState(initial);
  const [edit, setEdit] = useState<UserRow | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const rows = only ? users.filter((u) => u.roles.includes(only)) : users;
  const grantable: Role[] = canGrantStaff
    ? ["student", "guardian", "mentor", ...STAFF_ROLES]
    : ["student", "guardian", "mentor"];
  return (
    <Card>
      <DataTable
        rows={rows}
        rowKey={(u) => u.id}
        searchText={(u) => `${u.name} ${u.email}`}
        filters={{
          label: "Status",
          options: [
            { value: "active", label: "Active" },
            { value: "pending", label: "Pending" },
            { value: "suspended", label: "Suspended" },
          ],
          test: (u, v) => u.status === v,
        }}
        columns={[
          {
            key: "n",
            header: "User",
            cell: (u) => (
              <span className="flex items-center gap-2.5">
                <Avatar name={u.name} hue={u.name.length * 23} size={32} />
                <span>
                  <span className="block font-semibold">{u.name}</span>
                  <span className="text-[11px] text-muted">{u.email}</span>
                </span>
              </span>
            ),
            sort: (u) => u.name,
          },
          {
            key: "r",
            header: "Roles",
            cell: (u) => (
              <span className="flex flex-wrap gap-1">
                {u.roles.map((r) => (
                  <Badge key={r} tone={STAFF_ROLES.includes(r) ? "violet" : "blue"}>
                    {ROLE_LABEL[r]}
                  </Badge>
                ))}
              </span>
            ),
          },
          {
            key: "s",
            header: "Status",
            cell: (u) => (
              <Badge
                tone={u.status === "active" ? "green" : u.status === "pending" ? "amber" : "red"}
              >
                {u.status}
              </Badge>
            ),
          },
          {
            key: "j",
            header: "Joined",
            cell: (u) => formatDate(u.joinedAt, lang),
            sort: (u) => u.joinedAt,
          },
          {
            key: "l",
            header: "Last active",
            cell: (u) => formatDate(u.lastActive, lang, true),
            sort: (u) => u.lastActive,
          },
          {
            key: "a",
            header: "",
            cell: (u) => (
              <span className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => (e.stopPropagation(), setEdit(u), setRoles(u.roles))}
                >
                  <UserCog size={14} /> Roles
                </Button>
                <Button
                  size="sm"
                  variant={u.status === "suspended" ? "success" : "ghost"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setUsers((us) =>
                      us.map((x) =>
                        x.id === u.id
                          ? { ...x, status: x.status === "suspended" ? "active" : "suspended" }
                          : x,
                      ),
                    );
                    toast({
                      tone: "success",
                      title:
                        u.status === "suspended" ? `${u.name} reactivated` : `${u.name} suspended`,
                      body: "Demo only — not saved. Logged in the audit trail.",
                    });
                  }}
                >
                  {u.status === "suspended" ? "Reactivate" : "Suspend"}
                </Button>
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
              onClick={() => (
                setUsers((us) => us.map((x) => (x.id === edit!.id ? { ...x, roles } : x))),
                setEdit(null),
                toast({ tone: "success", title: "Roles updated", body: "Demo only — not saved." })
              )}
            >
              Save roles
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          Roles are EduKhata-only. Signing in with WAN ID never grants them. Mentor requires an
          approved application.
        </p>
        <ul className="space-y-2">
          {(["student", "guardian", "mentor", ...STAFF_ROLES] as Role[]).map((r) => {
            const allowed = grantable.includes(r);
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
    </Card>
  );
}

export function MentorApplications({ apps: initial }: { apps: MentorApplication[] }) {
  const { lang } = useT();
  const toast = useToast();
  const [apps, setApps] = useState(initial);
  const [sel, setSel] = useState<MentorApplication | null>(null);
  const [note, setNote] = useState("");
  const decide = (status: MentorApplication["status"], msg: string) => {
    setApps((as) => as.map((a) => (a.id === sel!.id ? { ...a, status } : a)));
    toast({ tone: "success", title: msg, body: "Demo only — not saved." });
    setSel(null);
    setNote("");
  };
  const docTone = { verified: "green", under_review: "amber", rejected: "red" } as const;
  return (
    <Card>
      <DataTable
        rows={apps}
        rowKey={(a) => a.id}
        onRowClick={setSel}
        searchText={(a) => `${a.name} ${a.subjects.join(" ")}`}
        columns={[
          {
            key: "n",
            header: "Applicant",
            cell: (a) => (
              <span>
                <span className="block font-semibold">{a.name}</span>
                <span className="text-[11px] text-muted">{a.education}</span>
              </span>
            ),
          },
          {
            key: "s",
            header: "Subjects",
            cell: (a) => a.subjects.map((s) => subjectName(s)).join(", "),
          },
          {
            key: "d",
            header: "Documents",
            cell: (a) => (
              <span className="flex flex-wrap gap-1">
                {a.documents.map((d) => (
                  <Badge key={d.type} tone={docTone[d.status]}>
                    {d.type}
                  </Badge>
                ))}
              </span>
            ),
          },
          {
            key: "t",
            header: "Skill test",
            cell: (a) => (a.skillTestScore ? `${a.skillTestScore}%` : "—"),
          },
          {
            key: "st",
            header: "Status",
            cell: (a) => (
              <Badge
                tone={
                  a.status === "approved"
                    ? "green"
                    : a.status === "rejected"
                      ? "red"
                      : a.status === "needs_info"
                        ? "amber"
                        : "blue"
                }
              >
                {a.status.replace("_", " ")}
              </Badge>
            ),
          },
          {
            key: "w",
            header: "Submitted",
            cell: (a) => formatDate(a.submittedAt, lang),
            sort: (a) => a.submittedAt,
          },
        ]}
      />
      <Modal
        open={!!sel}
        onClose={() => setSel(null)}
        title={`Application — ${sel?.name}`}
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => decide("needs_info", "Asked applicant for more information")}
            >
              Request info
            </Button>
            <Button variant="danger" onClick={() => decide("rejected", "Application rejected")}>
              Reject
            </Button>
            <Button
              variant="success"
              disabled={sel?.documents.some((d) => d.status !== "verified")}
              onClick={() => decide("approved", "Mentor role granted")}
            >
              Approve & grant mentor role
            </Button>
          </>
        }
      >
        {sel && (
          <div className="space-y-4">
            <KeyValue
              items={[
                ["Education", sel.education],
                ["Subjects", sel.subjects.map((s) => subjectName(s)).join(", ")],
                ["Skill test", sel.skillTestScore ? `${sel.skillTestScore}%` : "Not taken"],
                ["Submitted", formatDate(sel.submittedAt, lang)],
              ]}
            />
            <ul className="space-y-2">
              {sel.documents.map((d) => (
                <li
                  key={d.type}
                  className="flex items-center gap-3 rounded-lg border border-line p-2.5 text-sm"
                >
                  <FileText size={16} className="text-muted" />
                  <span className="flex-1 font-medium capitalize">{d.type}</span>
                  <Badge tone={docTone[d.status]}>{d.status.replace("_", " ")}</Badge>
                  <button
                    className="flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)]"
                    onClick={() =>
                      toast({
                        tone: "info",
                        title: "Secure document viewer",
                        body: "Opened via short-lived signed link; access is logged (Phase 6).",
                      })
                    }
                  >
                    <Eye size={13} /> View
                  </button>
                </li>
              ))}
            </ul>
            {sel.documents.some((d) => d.status !== "verified") && (
              <p className="text-xs text-warning">
                Approve is enabled after every document is verified in the Verification Queue.
              </p>
            )}
            <Field label="Note to applicant" htmlFor="ma-n">
              <textarea
                id="ma-n"
                rows={2}
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </div>
        )}
      </Modal>
    </Card>
  );
}

export function VerificationQueue() {
  const toast = useToast();
  const [tab, setTab] = useState<"identity" | "qualification" | "institution">("identity");
  const items = {
    identity: [
      ["Imran Kabir", "National ID", "Mentor applicant", "20 h ago"],
      ["Lamia Chowdhury", "Passport", "Mentor applicant", "1 d ago"],
    ],
    qualification: [
      ["Imran Kabir", "BSc certificate (KUET)", "Mentor applicant", "20 h ago"],
      ["Lamia Chowdhury", "Transcript", "Mentor applicant", "1 d ago"],
      ["Dr. Mizanur Rahman", "Transcript (re-upload)", "Mentor", "2 h ago"],
    ],
    institution: [["Tanvir Hossain", "University ID card", "Student", "3 d ago"]],
  } as const;
  return (
    <Card>
      <Tabs
        className="px-3"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "identity", label: "Identity (NID/passport)", count: items.identity.length },
          { id: "qualification", label: "Qualifications", count: items.qualification.length },
          { id: "institution", label: "Student / institution", count: items.institution.length },
        ]}
      />
      <ul className="divide-y divide-line">
        {items[tab].map(([who, doc, role, when]) => (
          <li key={who + doc} className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <Lock size={16} className="text-muted" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{doc}</p>
              <p className="text-xs text-muted">
                {who} · {role} · {when}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                toast({
                  tone: "info",
                  title: "Secure viewer",
                  body: "Signed, short-lived link; every view is logged.",
                })
              }
            >
              <Eye size={14} /> Review
            </Button>
            <Button
              size="sm"
              variant="success"
              onClick={() =>
                toast({ tone: "success", title: `${doc} verified`, body: "Demo only — not saved." })
              }
            >
              <BadgeCheck size={14} /> Verify
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                toast({
                  tone: "warning",
                  title: `${doc} rejected`,
                  body: "Applicant is asked to re-upload. Demo only.",
                })
              }
            >
              Reject
            </Button>
          </li>
        ))}
      </ul>
      <p className="flex gap-2 border-t border-line px-4 py-3 text-[11px] text-muted">
        <ShieldCheck size={14} className="shrink-0" /> Identity documents are stored in a private
        bucket, never shown in lists, and only reviewers with the verification permission can open
        them. NID handling follows the legal review (pending).
      </p>
    </Card>
  );
}

const PERMS = [
  ["orders.view_all", "View all orders"],
  ["orders.assign", "Assign / reassign mentors"],
  ["orders.cancel_refund", "Cancel & create refunds"],
  ["disputes.decide", "Decide disputes"],
  ["payments.verify", "Verify payments"],
  ["payouts.approve", "Approve payouts"],
  ["ledger.view", "View ledger & reports"],
  ["users.manage", "Suspend / reactivate users"],
  ["mentors.approve", "Approve mentors & documents"],
  ["content.manage", "Catalog, CMS, blog, banners"],
  ["reviews.moderate", "Moderate reviews & content"],
  ["tickets.handle", "Handle support tickets"],
  ["settings.system", "System settings & commission"],
  ["roles.manage", "Manage staff & roles"],
  ["audit.view", "View audit log"],
] as const;

const MATRIX: Record<string, Role[]> = {
  "orders.view_all": ["admin", "super_admin", "supporter", "accountant"],
  "orders.assign": ["admin", "super_admin"],
  "orders.cancel_refund": ["admin", "super_admin"],
  "disputes.decide": ["admin", "super_admin"],
  "payments.verify": ["accountant", "admin", "super_admin"],
  "payouts.approve": ["accountant", "super_admin"],
  "ledger.view": ["accountant", "super_admin"],
  "users.manage": ["admin", "super_admin"],
  "mentors.approve": ["admin", "super_admin"],
  "content.manage": ["admin", "super_admin"],
  "reviews.moderate": ["admin", "super_admin"],
  "tickets.handle": ["supporter", "admin", "super_admin"],
  "settings.system": ["super_admin"],
  "roles.manage": ["super_admin"],
  "audit.view": ["super_admin", "accountant"],
};

export function RolesMatrix() {
  const toast = useToast();
  const [m, setM] = useState(MATRIX);
  const cols: Role[] = ["supporter", "accountant", "admin", "super_admin"];
  return (
    <Card>
      <CardHeader
        title="Staff permission matrix"
        sub="Super Admin always keeps settings and role management. Changes are audited."
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-xs text-muted uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Permission</th>
              {cols.map((c) => (
                <th key={c} className="px-4 py-2">
                  {ROLE_LABEL[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {PERMS.map(([k, l]) => (
              <tr key={k}>
                <td className="px-4 py-2.5">
                  <span className="block font-medium">{l}</span>
                  <span className="font-mono text-[11px] text-muted">{k}</span>
                </td>
                {cols.map((c) => {
                  const locked =
                    c === "super_admin" && (k === "settings.system" || k === "roles.manage");
                  return (
                    <td key={c} className="px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${l} for ${ROLE_LABEL[c]}`}
                        disabled={locked}
                        checked={m[k]!.includes(c)}
                        onChange={(e) =>
                          setM({
                            ...m,
                            [k]: e.target.checked ? [...m[k]!, c] : m[k]!.filter((x) => x !== c),
                          })
                        }
                        className="h-4 w-4 accent-[var(--color-accent)]"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end border-t border-line p-4">
        <Button
          variant="accent"
          onClick={() =>
            toast({
              tone: "success",
              title: "Permissions saved",
              body: "Demo only — enforced by the API from Phase 2.",
            })
          }
        >
          Save changes
        </Button>
      </div>
    </Card>
  );
}

export function StaffList() {
  return (
    <UsersTable
      users={fixtures.users.filter((u) => u.roles.some((r) => STAFF_ROLES.includes(r)))}
      canGrantStaff
    />
  );
}
