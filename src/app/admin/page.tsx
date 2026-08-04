import { redirect } from "next/navigation";

import { getSession } from "@/server/auth/session";
import { connectDB } from "@/server/db/client";
import * as usersService from "@/server/modules/users/service";
import * as rolesService from "@/server/modules/roles/service";
import * as licensesService from "@/server/modules/licenses/service";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) return null;
  if (!session.isSuperAdmin) redirect("/");

  const db = await connectDB();
  const [users, roles, licenses] = await Promise.all([
    usersService.listUsers(db),
    rolesService.listRoles(db),
    licensesService.listLicenses(db),
  ]);

  return <AdminDashboard initialUsers={users} initialRoles={roles} initialLicenses={licenses} />;
}
