"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { UsersPanel, type PublicUser } from "@/components/admin/users-panel";
import { RolesPanel, type PublicRole } from "@/components/admin/roles-panel";
import { LicensesPanel, type PublicLicense } from "@/components/admin/licenses-panel";

type Tab = "users" | "roles" | "licenses";

export function AdminDashboard({
  initialUsers,
  initialRoles,
  initialLicenses,
}: {
  initialUsers: PublicUser[];
  initialRoles: PublicRole[];
  initialLicenses: PublicLicense[];
}) {
  const [tab, setTab] = useState<Tab>("licenses");

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
            &larr; Casos
          </Link>
          <h1 className="text-xl font-semibold">Administracao</h1>
        </div>
      </header>

      <div className="mb-6 flex gap-1 border-b border-border">
        {([
          ["licenses", "Licencas"],
          ["users", "Usuarios"],
          ["roles", "Roles"],
        ] as [Tab, string][]).map(([id, label]) => (
          <Button
            key={id}
            variant="ghost"
            size="sm"
            className={tab === id ? "border-b-2 border-primary rounded-none" : "rounded-none"}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "licenses" && <LicensesPanel initialLicenses={initialLicenses} users={initialUsers} />}
      {tab === "users" && <UsersPanel initialUsers={initialUsers} roles={initialRoles} />}
      {tab === "roles" && <RolesPanel initialRoles={initialRoles} />}
    </main>
  );
}
