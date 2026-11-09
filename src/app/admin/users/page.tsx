import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, button, Card, Field, input, PageHeader, table } from "@/components/ui";
import { config } from "@/lib/config";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/staff";
import { grantAccessAction, revokeAccessAction } from "../actions";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const admin = await requireAdmin();
  const rows = await db.staffAccess.findMany({ orderBy: [{ active: "desc" }, { email: "asc" }] });
  const bootstrap = config.bootstrapAdminEmails.filter((e) => !rows.some((r) => r.email === e));

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={`People who can sign in with their @${config.staffEmailDomain} Google account. Admins can also manage this list.`}
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className="bg-slate-50">
              <tr>
                <th className={table.th}>Email</th>
                <th className={table.th}>Role</th>
                <th className={table.th}>Added</th>
                <th className={table.th}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bootstrap.map((email) => (
                <tr key={email}>
                  <td className={table.td}>{email}</td>
                  <td className={table.td}>
                    <Badge tone="blue">Admin</Badge>
                  </td>
                  <td className={`${table.td} text-xs text-slate-500`}>Set in BOOTSTRAP_ADMIN_EMAILS</td>
                  <td className={table.td}></td>
                </tr>
              ))}
              {rows.map((row) => (
                <tr key={row.email} className={row.active ? undefined : "text-slate-400"}>
                  <td className={table.td}>{row.email}</td>
                  <td className={table.td}>
                    {row.active ? (
                      <Badge tone={row.role === "ADMIN" ? "blue" : "gray"}>{row.role === "ADMIN" ? "Admin" : "Staff"}</Badge>
                    ) : (
                      <Badge>Removed</Badge>
                    )}
                  </td>
                  <td className={`${table.td} text-xs text-slate-500`}>
                    {formatDate(row.createdAt)} by {row.addedBy}
                  </td>
                  <td className={`${table.td} text-right`}>
                    {row.active && row.email !== admin.email ? (
                      <ActionForm
                        action={revokeAccessAction.bind(null, row.email)}
                        confirm={`Remove access for ${row.email}? They are signed out at once.`}
                      >
                        <SubmitButton className="text-sm font-medium text-red-700 hover:underline" pendingText="…">
                          Remove
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Card>
          <h2 className="mb-4 text-base font-semibold text-ink">Add or change someone</h2>
          <ActionForm action={grantAccessAction} resetOnSuccess className="space-y-4">
            <Field label="Email" name="email" required>
              <input id="email" name="email" type="email" required className={input} placeholder={`name@${config.staffEmailDomain}`} />
            </Field>
            <Field label="Role" name="role" required>
              <select id="role" name="role" defaultValue="STAFF" className={input}>
                <option value="STAFF">Staff: lots, units and reports</option>
                <option value="ADMIN">Admin: also manages users</option>
              </select>
            </Field>
            <SubmitButton className={button.primary}>Save</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
