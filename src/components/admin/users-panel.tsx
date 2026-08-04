"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Plus, UserRound } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiClientError } from "@/client/api/client";
import { RoleBadge } from "@/components/roles/role-badge";
import type { PublicRole } from "@/components/admin/roles-panel";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  color: string;
  active: boolean;
  roleIds: string[];
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

/** Mesmo padrao do Sistema do Aluno: tabela com avatar/roles/status, clique na linha abre o painel
 *  de edicao (aqui um Dialog, ja que nao portamos o componente Sheet). */
export function UsersPanel({ initialUsers, roles }: { initialUsers: PublicUser[]; roles: PublicRole[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PublicUser | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const roleById = new Map(roles.map((role) => [role.id, role]));

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { user } = await api.post<{ user: PublicUser }>("/api/users", { name, email, password, roleIds: [] });
      setUsers((prev) => [user, ...prev]);
      setName("");
      setEmail("");
      setPassword("");
      setCreateOpen(false);
      toast.success("Usuario criado.");
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Falha ao criar usuario");
    } finally {
      setBusy(false);
    }
  }

  async function patchUser(userId: string, patch: Record<string, unknown>) {
    try {
      const { user } = await api.patch<{ user: PublicUser }>(`/api/users/${userId}`, patch);
      setUsers((prev) => prev.map((u) => (u.id === userId ? user : u)));
      setEditingUser((prev) => (prev?.id === userId ? user : prev));
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Falha ao salvar usuario");
    }
  }

  function toggleRole(user: PublicUser, roleId: string) {
    const roleIds = user.roleIds.includes(roleId) ? user.roleIds.filter((id) => id !== roleId) : [...user.roleIds, roleId];
    void patchUser(user.id, { roleIds });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Membros do sistema e suas roles.</p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Novo usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo usuario</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Senha provisoria</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy}>
                  Criar usuario
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                  <UserRound className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  Nenhum usuario cadastrado ainda
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => (
              <TableRow key={user.id} className="cursor-pointer" onClick={() => setEditingUser(user)}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback style={{ backgroundColor: user.color, color: "white" }}>
                        {initials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium leading-none">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.roleIds.map((roleId) => {
                      const role = roleById.get(roleId);
                      return role ? <RoleBadge key={roleId} name={role.name} color={role.color} /> : null;
                    })}
                    {user.roleIds.length === 0 && <span className="text-xs text-muted-foreground">Sem role</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.active ? "success" : "outline"}>{user.active ? "Ativo" : "Inativo"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          {editingUser && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback style={{ backgroundColor: editingUser.color, color: "white" }}>
                      {initials(editingUser.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <DialogTitle>{editingUser.name}</DialogTitle>
                    <p className="text-sm text-muted-foreground">{editingUser.email}</p>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Usuario ativo</p>
                  <p className="text-xs text-muted-foreground">Desative pra bloquear o acesso sem apagar a conta</p>
                </div>
                <Switch
                  checked={editingUser.active}
                  onCheckedChange={(active) => patchUser(editingUser.id, { active })}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Roles</Label>
                <div className="space-y-1 rounded-md border p-2">
                  {roles.map((role) => (
                    <label key={role.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent">
                      <Checkbox
                        checked={editingUser.roleIds.includes(role.id)}
                        onCheckedChange={() => toggleRole(editingUser, role.id)}
                      />
                      <RoleBadge name={role.name} color={role.color} />
                    </label>
                  ))}
                  {roles.length === 0 && <p className="px-2 py-1 text-sm text-muted-foreground">Nenhuma role criada ainda</p>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
