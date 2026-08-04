"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/client/api/client";
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

export function LicensesPanel({ initialLicenses, users }: { initialLicenses: PublicLicense[]; users: PublicUser[] }) {
  const [licenses, setLicenses] = useState(initialLicenses);
  const [userId, setUserId] = useState("");
  const [plan, setPlan] = useState("standard");
  const [days, setDays] = useState(365);
  const [busy, setBusy] = useState(false);

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? id;

  async function handleIssue(event: FormEvent) {
    event.preventDefault();
    if (!userId) return;
    setBusy(true);
    try {
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const { license } = await api.post<{ license: PublicLicense }>("/api/licenses", { userId, plan, expiresAt });
      setLicenses((prev) => [license, ...prev]);
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    const { license } = await api.post<{ license: PublicLicense }>(`/api/licenses/${id}/revoke`, {
      reason: "Revogado pelo administrador",
    });
    setLicenses((prev) => prev.map((l) => (l.id === id ? license : l)));
  }

  async function handleExtend(id: string) {
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const { license } = await api.post<{ license: PublicLicense }>(`/api/licenses/${id}/extend`, { expiresAt });
    setLicenses((prev) => prev.map((l) => (l.id === id ? license : l)));
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
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32 space-y-1.5">
              <Label>Plano</Label>
              <Input value={plan} onChange={(e) => setPlan(e.target.value)} />
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
                  Plano {license.plan} · expira em {new Date(license.expiresAt).toLocaleDateString("pt-BR")}
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
