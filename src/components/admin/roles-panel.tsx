"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/client/api/client";
import { PERMISSION_CATEGORIES } from "@/server/rbac/permissions";

export interface PublicRole {
  id: string;
  name: string;
  color: string;
  position: number;
  permissions: string[];
  isDefault: boolean;
}

const COLOR_PRESETS = ["#5865F2", "#57F287", "#FEE75C", "#EB459E", "#ED4245", "#EB8F45", "#99AAB5"];

export function RolesPanel({ initialRoles }: { initialRoles: PublicRole[] }) {
  const [roles, setRoles] = useState(initialRoles);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { role } = await api.post<{ role: PublicRole }>("/api/roles", { name, color, permissions });
      setRoles((prev) => [...prev, role].sort((a, b) => b.position - a.position));
      setName("");
      setPermissions([]);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(roleId: string) {
    await api.delete(`/api/roles/${roleId}`);
    setRoles((prev) => prev.filter((r) => r.id !== roleId));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nova role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] space-y-1.5">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <div className="flex gap-1">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="h-6 w-6 rounded-full border-2"
                      style={{ backgroundColor: c, borderColor: color === c ? "white" : "transparent" }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {PERMISSION_CATEGORIES.map((category) => (
                <div key={category.key}>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{category.label}</p>
                  <div className="flex flex-wrap gap-3">
                    {category.permissions.map((perm) => (
                      <label key={perm.key} className="flex items-center gap-1.5 text-xs" title={perm.description}>
                        <input
                          type="checkbox"
                          checked={permissions.includes(perm.key)}
                          onChange={(e) =>
                            setPermissions((prev) =>
                              e.target.checked ? [...prev, perm.key] : prev.filter((p) => p !== perm.key)
                            )
                          }
                        />
                        {perm.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Button type="submit" disabled={busy}>
              Criar role
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {roles.map((role) => (
          <Card key={role.id}>
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: role.color }} />
                <p className="text-sm font-medium">{role.name}</p>
                {role.isDefault && <Badge variant="secondary">Administrador (padrao)</Badge>}
                <span className="text-xs text-muted-foreground">{role.permissions.length} permissoes</span>
              </div>
              {!role.isDefault && (
                <Button size="sm" variant="destructive" onClick={() => handleDelete(role.id)}>
                  Excluir
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
