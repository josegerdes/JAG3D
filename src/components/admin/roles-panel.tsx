"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Shield, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { api, ApiClientError } from "@/client/api/client";
import { PERMISSION_CATEGORIES } from "@/server/rbac/permissions";

export interface PublicRole {
  id: string;
  name: string;
  color: string;
  position: number;
  permissions: string[];
  isDefault: boolean;
}

const COLOR_PRESETS = [
  "#5865F2", "#57F287", "#FEE75C", "#EB459E", "#ED4245",
  "#3BA55D", "#FAA61A", "#9B59B6", "#1ABC9C", "#7289DA",
];

/** Mesmo padrao de duas colunas (lista + edicao) do painel de Roles do Sistema do Aluno — lista a
 *  esquerda seleciona, painel a direita edita em tempo real (salva em cada mudanca, sem botao
 *  "Salvar" separado, igual Discord). */
export function RolesPanel({ initialRoles }: { initialRoles: PublicRole[] }) {
  const [roles, setRoles] = useState(initialRoles);
  const [selectedId, setSelectedId] = useState<string | null>(initialRoles[0]?.id ?? null);
  const [creating, setCreating] = useState(false);

  const selected = roles.find((role) => role.id === selectedId) ?? null;

  function updateLocal(role: PublicRole) {
    setRoles((prev) => prev.map((r) => (r.id === role.id ? role : r)));
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const { role } = await api.post<{ role: PublicRole }>("/api/roles", {
        name: "Nova role",
        color: COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)],
        permissions: [],
      });
      setRoles((prev) => [...prev, role]);
      setSelectedId(role.id);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Falha ao criar role");
    } finally {
      setCreating(false);
    }
  }

  async function patchRole(roleId: string, patch: Record<string, unknown>) {
    try {
      const { role } = await api.patch<{ role: PublicRole }>(`/api/roles/${roleId}`, patch);
      updateLocal(role);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Falha ao salvar role");
    }
  }

  async function handleDelete(role: PublicRole) {
    if (!window.confirm(`Excluir a role "${role.name}"?`)) return;
    try {
      await api.delete(`/api/roles/${role.id}`);
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      if (selectedId === role.id) setSelectedId(null);
      toast.success("Role excluida");
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Falha ao excluir role");
    }
  }

  function togglePermission(role: PublicRole, permissionKey: string) {
    if (role.isDefault) return;
    const has = role.permissions.includes(permissionKey);
    const permissions = has ? role.permissions.filter((k) => k !== permissionKey) : [...role.permissions, permissionKey];
    updateLocal({ ...role, permissions });
    void patchRole(role.id, { permissions });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Roles ({roles.length})</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={creating} onClick={handleCreate}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="h-[520px]">
          <div className="p-2">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  role.id === selectedId ? "bg-accent" : "hover:bg-accent/50"
                )}
                onClick={() => setSelectedId(role.id)}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: role.color }} />
                <span className="truncate">{role.name}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="rounded-lg border bg-card p-6">
        {!selected && (
          <div className="flex h-full flex-col items-center justify-center py-16 text-muted-foreground">
            <Shield className="mb-2 h-8 w-8 opacity-50" />
            Selecione uma role para editar
          </div>
        )}
        {selected && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 space-y-1.5">
                <Label>Nome</Label>
                <Input
                  key={selected.id}
                  defaultValue={selected.name}
                  onBlur={(event) => {
                    const name = event.target.value.trim();
                    if (name && name !== selected.name) {
                      updateLocal({ ...selected, name });
                      void patchRole(selected.id, { name });
                    }
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <div className="flex gap-1.5">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        "h-7 w-7 rounded-full border-2",
                        selected.color === color ? "border-foreground" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        updateLocal({ ...selected, color });
                        void patchRole(selected.id, { color });
                      }}
                    />
                  ))}
                </div>
              </div>
              {!selected.isDefault && (
                <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleDelete(selected)}>
                  <Trash2 className="h-4 w-4" />
                  Excluir role
                </Button>
              )}
            </div>

            <Separator />

            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Permissoes</p>
                {selected.isDefault && <Badge variant="success">Administrador — sempre todas ligadas</Badge>}
              </div>
              {PERMISSION_CATEGORIES.map((category) => (
                <div key={category.key} className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category.label}</p>
                  <div className="space-y-1 rounded-md border">
                    {category.permissions.map((permission) => (
                      <div
                        key={permission.key}
                        className="flex items-center justify-between gap-4 border-b px-3 py-2.5 last:border-b-0"
                      >
                        <div>
                          <p className="text-sm font-medium">{permission.label}</p>
                          <p className="text-xs text-muted-foreground">{permission.description}</p>
                        </div>
                        <Switch
                          checked={selected.isDefault || selected.permissions.includes(permission.key)}
                          disabled={selected.isDefault}
                          onCheckedChange={() => togglePermission(selected, permission.key)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
