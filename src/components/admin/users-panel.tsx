"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/client/api/client";
import type { PublicRole } from "@/components/admin/roles-panel";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  color: string;
  active: boolean;
  roleIds: string[];
}

export function UsersPanel({ initialUsers, roles }: { initialUsers: PublicUser[]; roles: PublicRole[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { user } = await api.post<{ user: PublicUser }>("/api/users", { name, email, password, roleIds });
      setUsers((prev) => [user, ...prev]);
      setName("");
      setEmail("");
      setPassword("");
      setRoleIds([]);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(user: PublicUser) {
    const { user: updated } = await api.patch<{ user: PublicUser }>(`/api/users/${user.id}`, { active: !user.active });
    setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Novo usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" onSubmit={handleCreate}>
            <div className="min-w-[160px] space-y-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="min-w-[200px] space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="min-w-[160px] space-y-1.5">
              <Label>Senha</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            <div className="min-w-[220px] space-y-1.5">
              <Label>Roles</Label>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <label key={role.id} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={roleIds.includes(role.id)}
                      onChange={(e) =>
                        setRoleIds((prev) => (e.target.checked ? [...prev, role.id] : prev.filter((id) => id !== role.id)))
                      }
                    />
                    {role.name}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={busy}>
              Criar
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {users.map((user) => (
          <Card key={user.id}>
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {user.roleIds.map((id) => (
                    <Badge key={id} variant="secondary">
                      {roleName(id)}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={user.active ? "success" : "destructive"}>{user.active ? "Ativo" : "Inativo"}</Badge>
                <Button size="sm" variant="outline" onClick={() => toggleActive(user)}>
                  {user.active ? "Desativar" : "Reativar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
