"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiClientError } from "@/client/api/client";
import type { PublicUser } from "@/components/admin/users-panel";

export interface PublicLicense {
  id: string;
  userId: string;
  plan: string;
  status: "active" | "revoked" | "expired";
  issuedAt: string | Date;
  expiresAt: string | Date;
  revokedAt: string | Date | null;
  revokedReason: string | null;
}

/** Planos fixos — Fase 1 nao tem tiering de verdade (self-service vem depois), mas um campo de
 *  texto livre pra "plano" nao fazia sentido nenhum pro admin preencher — ver ARCHITECTURE.md. */
const PLAN_OPTIONS = [
  { value: "trial", label: "Trial" },
  { value: "standard", label: "Standard" },
  { value: "pro", label: "Pro" },
  { value: "admin", label: "Administrador" },
];

export function LicensesPanel({ initialLicenses, users }: { initialLicenses: PublicLicense[]; users: PublicUser[] }) {
  const [licenses, setLicenses] = useState(initialLicenses);
  const [userId, setUserId] = useState("");
  const [plan, setPlan] = useState("standard");
  const [days, setDays] = useState(365);
  const [busy, setBusy] = useState(false);

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const usersWithoutActiveLicense = users.filter(
    (u) => !licenses.some((l) => l.userId === u.id && l.status === "active")
  );

  async function handleIssue(event: FormEvent) {
    event.preventDefault();
    if (!userId) return;
    setBusy(true);
    try {
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const { license } = await api.post<{ license: PublicLicense }>("/api/licenses", { userId, plan, expiresAt });
      setLicenses((prev) => [license, ...prev]);
      setUserId("");
      toast.success("Licenca emitida.");
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Falha ao emitir licenca");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      const { license } = await api.post<{ license: PublicLicense }>(`/api/licenses/${id}/revoke`, {
        reason: "Revogado pelo administrador",
      });
      setLicenses((prev) => prev.map((l) => (l.id === id ? license : l)));
      toast.success("Licenca revogada.");
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Falha ao revogar licenca");
    }
  }

  async function handleExtend(id: string) {
    try {
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const { license } = await api.post<{ license: PublicLicense }>(`/api/licenses/${id}/extend`, { expiresAt });
      setLicenses((prev) => prev.map((l) => (l.id === id ? license : l)));
      toast.success("Licenca estendida por mais 1 ano.");
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Falha ao estender licenca");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Emitir licenca</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" onSubmit={handleIssue}>
            <div className="min-w-[220px] space-y-1.5">
              <Label>Usuario</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {usersWithoutActiveLicense.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                  {usersWithoutActiveLicense.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Todos os usuarios ja tem licenca ativa.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40 space-y-1.5">
              <Label>Plano</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28 space-y-1.5">
              <Label>Dias</Label>
              <Input type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))} />
            </div>
            <Button type="submit" disabled={busy || !userId}>
              Emitir
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {licenses.map((license) => (
          <Card key={license.id}>
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">{userName(license.userId)}</p>
                <p className="text-xs text-muted-foreground">
                  Plano {PLAN_OPTIONS.find((p) => p.value === license.plan)?.label ?? license.plan} · expira em{" "}
                  {new Date(license.expiresAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={license.status} />
                <Button size="sm" variant="outline" onClick={() => handleExtend(license.id)}>
                  Estender 1 ano
                </Button>
                {license.status === "active" && (
                  <Button size="sm" variant="destructive" onClick={() => handleRevoke(license.id)}>
                    Revogar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {licenses.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma licenca emitida ainda.</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge variant="success">Ativa</Badge>;
  if (status === "revoked") return <Badge variant="destructive">Revogada</Badge>;
  return <Badge variant="secondary">Expirada</Badge>;
}
