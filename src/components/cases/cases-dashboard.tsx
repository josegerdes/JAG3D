"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiClientError } from "@/client/api/client";

interface PublicCase {
  id: string;
  name: string;
  patientRef: string | null;
  status: "draft" | "active" | "archived";
  updatedAt: string | Date;
}

interface SessionSummary {
  name: string;
  email: string;
  isSuperAdmin: boolean;
  hasActiveLicense: boolean;
}

export function CasesDashboard({ session, initialCases }: { session: SessionSummary; initialCases: PublicCase[] }) {
  const router = useRouter();
  const [cases, setCases] = useState(initialCases);
  const [name, setName] = useState("");
  const [patientRef, setPatientRef] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const { case: created } = await api.post<{ case: PublicCase }>("/api/cases", {
        name,
        patientRef: patientRef || undefined,
      });
      setCases((prev) => [created, ...prev]);
      setName("");
      setPatientRef("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar caso");
    } finally {
      setCreating(false);
    }
  }

  async function handleLogout() {
    await api.post("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  async function handleImportZip(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { case: created } = await api.postForm<{ case: PublicCase }>("/api/cases/import-zip", form);
      toast.success(`Projeto "${created.name}" importado.`);
      router.push(`/cases/${created.id}`);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Falha ao importar projeto");
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">JAG3D</h1>
          <p className="text-sm text-muted-foreground">
            {session.name} · {session.email}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {session.hasActiveLicense ? (
            <Badge variant="success">Licenca ativa</Badge>
          ) : (
            <Badge variant="destructive">Sem licenca ativa</Badge>
          )}
          <input ref={importInputRef} type="file" accept=".zip" className="hidden" onChange={handleImportZip} />
          <Button variant="outline" size="sm" disabled={importing} onClick={() => importInputRef.current?.click()}>
            {importing ? "Importando..." : "Abrir projeto (.zip)"}
          </Button>
          {session.isSuperAdmin && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin">Administracao</Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Sair
          </Button>
        </div>
      </header>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Novo caso</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" onSubmit={handleCreate}>
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <label className="text-sm font-medium">Nome do caso</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ex: Caso 001" />
            </div>
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <label className="text-sm font-medium">Referencia (opcional)</label>
              <Input value={patientRef} onChange={(e) => setPatientRef(e.target.value)} placeholder="Codigo/identificador" />
            </div>
            <Button type="submit" disabled={creating || !session.hasActiveLicense}>
              {creating ? "Criando..." : "Criar caso"}
            </Button>
          </form>
          {!session.hasActiveLicense && (
            <p className="mt-2 text-xs text-destructive">
              Sua licenca esta inativa — fale com o administrador pra criar ou editar casos.
            </p>
          )}
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cases.map((caseDoc) => (
          <Link key={caseDoc.id} href={`/cases/${caseDoc.id}`}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {caseDoc.name}
                  <Badge variant="secondary">{caseDoc.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {caseDoc.patientRef ?? "Sem referencia"}
              </CardContent>
            </Card>
          </Link>
        ))}
        {cases.length === 0 && <p className="text-sm text-muted-foreground">Nenhum caso ainda.</p>}
      </div>
    </main>
  );
}
