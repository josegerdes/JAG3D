"use client";

import { useEditorStore } from "@/client/state/editor-store";
import { Badge } from "@/components/ui/badge";

export function StatusBar() {
  const { syncStatus, licenseStatus, assets } = useEditorStore();
  const triangleCount = Object.values(assets).reduce((sum, a) => sum + a.triangleCount, 0);

  return (
    <div className="flex h-8 items-center justify-between border-t border-panel-border bg-panel px-3 text-xs text-panel-foreground">
      <div className="flex items-center gap-3">
        <span>{Object.keys(assets).length} malha(s)</span>
        <span>{triangleCount.toLocaleString("pt-BR")} triangulos</span>
      </div>
      <div className="flex items-center gap-2">
        <SyncBadge status={syncStatus} />
        <LicenseBadge status={licenseStatus} />
      </div>
    </div>
  );
}

function SyncBadge({ status }: { status: string }) {
  if (status === "conflict") return <Badge variant="destructive">Fora de sincronia — recarregue</Badge>;
  if (status === "checking") return <Badge variant="secondary">Verificando sincronia...</Badge>;
  return <Badge variant="success">Sincronizado</Badge>;
}

function LicenseBadge({ status }: { status: string }) {
  if (status === "inactive") return <Badge variant="destructive">Licenca inativa</Badge>;
  if (status === "checking") return <Badge variant="secondary">Verificando licenca...</Badge>;
  return <Badge variant="success">Licenca ativa</Badge>;
}
