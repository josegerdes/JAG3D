"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const STATUS_LABEL: Record<PublicCase["status"], string> = { draft: "Rascunho", active: "Ativo", archived: "Arquivado" };

export function CasesDashboard({ session, initialCases }: { session: SessionSummary; initialCases: PublicCase[] }) {
  const router = useRouter();
  const [cases, setCases] = useState(initialCases);
  const [name, setName] = useState("");
  const [patientRef, setPatientRef] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [editingCase, setEditingCase] = useState<PublicCase | null>(null);
  const [editName, setEditName] = useState("");
  const [editPatientRef, setEditPatientRef] = useState("");
  const [editStatus, setEditStatus] = useState<PublicCase["status"]>("draft");
  const [savingEdit, setSavingEdit] = useState(false);

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

  function openEdit(event: React.MouseEvent, caseDoc: PublicCase) {
    event.preventDefault();
    event.stopPropagation();
    setEditingCase(caseDoc);
    setEditName(caseDoc.name);
    setEditPatientRef(caseDoc.patientRef ?? "");
    setEditStatus(caseDoc.status);
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingCase) return;
    setSavingEdit(true);
    try {
      const { case: updated } = await api.patch<{ case: PublicCase }>(`/api/cases/${editingCase.id}`, {
        name: editName,
        patientRef: editPatientRef || null,
        status: editStatus,
      });
      setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingCase(null);
      toast.success("Caso atualizado.");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Falha ao salvar caso");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(event: React.MouseEvent, caseDoc: PublicCase) {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm(`Apagar o caso "${caseDoc.name}"? Essa acao nao pode ser desfeita.`)) return;
    try {
      await api.delete(`/api/cases/${caseDoc.id}`);
      setCases((prev) => prev.filter((c) => c.id !== caseDoc.id));
      toast.success("Caso apagado.");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Falha ao apagar caso");
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
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="truncate">{caseDoc.name}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant="secondary">{STATUS_LABEL[caseDoc.status]}</Badge>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => openEdit(e, caseDoc)} title="Editar">
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={(e) => handleDelete(e, caseDoc)}
                      title="Apagar"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
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

      <Dialog open={Boolean(editingCase)} onOpenChange={(open) => !open && setEditingCase(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar caso</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSaveEdit}>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Referencia</Label>
              <Input value={editPatientRef} onChange={(e) => setEditPatientRef(e.target.value)} placeholder="Codigo/identificador" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as PublicCase["status"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="archived">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
