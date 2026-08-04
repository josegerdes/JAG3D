"use client";

import { Grid3x3, Redo2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ToolId, useEditorStore } from "@/client/state/editor-store";

const TOOLS: { id: ToolId; label: string; shortcut: string; requiresSelectionMin?: number }[] = [
  { id: "select", label: "Selecionar", shortcut: "V" },
  { id: "transform", label: "Mover/Transformar", shortcut: "M", requiresSelectionMin: 1 },
  { id: "duplicate", label: "Duplicar", shortcut: "Ctrl+D", requiresSelectionMin: 1 },
  { id: "align", label: "Alinhar", shortcut: "A", requiresSelectionMin: 0 },
  { id: "booleanCut", label: "Corte booleano", shortcut: "B", requiresSelectionMin: 2 },
  { id: "relief", label: "Alivio (pincel)", shortcut: "R", requiresSelectionMin: 1 },
  { id: "smooth", label: "Suavizar (pincel)", shortcut: "S", requiresSelectionMin: 1 },
  { id: "compare", label: "Comparar antes/depois", shortcut: "C", requiresSelectionMin: 0 },
];

/**
 * Toolbar sempre visivel, estilo Photoshop — nenhuma ferramenta fica escondida atras de um fluxo
 * fechado. O que muda por contexto de selecao e so o habilitado/desabilitado (ver ARCHITECTURE.md).
 */
export function TopToolbar({
  onUndo,
  onGroup,
  onUpload,
  gridVisible,
  onToggleGrid,
  onDownloadProject,
  downloadingProject,
}: {
  onUndo: () => void;
  onGroup: () => void;
  onUpload: () => void;
  gridVisible: boolean;
  onToggleGrid: () => void;
  onDownloadProject: () => void;
  downloadingProject: boolean;
}) {
  const { activeTool, setActiveTool, selectedAssetIds } = useEditorStore();

  return (
    <div className="flex h-12 items-center gap-1 border-b border-panel-border bg-panel px-3">
      {TOOLS.map((tool) => {
        const disabled = (tool.requiresSelectionMin ?? 0) > selectedAssetIds.length;
        return (
          <Button
            key={tool.id}
            size="sm"
            variant={activeTool === tool.id ? "default" : "ghost"}
            disabled={disabled}
            onClick={() => setActiveTool(tool.id)}
            className={cn("text-xs")}
            title={`${tool.label} (${tool.shortcut})`}
          >
            {tool.label}
          </Button>
        );
      })}
      <div className="mx-2 h-6 w-px bg-panel-border" />
      <Button size="sm" variant="ghost" disabled={selectedAssetIds.length < 2} onClick={onGroup}>
        Agrupar
      </Button>
      <Button size="sm" variant="ghost" onClick={onUndo} title="Desfazer (Ctrl+Z)">
        <Undo2 className="mr-1 h-3.5 w-3.5" /> Desfazer
      </Button>
      <Button size="sm" variant="ghost" disabled title="Redo ainda nao implementado na Fase 1">
        <Redo2 className="mr-1 h-3.5 w-3.5" /> Refazer
      </Button>
      <Button
        size="sm"
        variant={gridVisible ? "default" : "ghost"}
        onClick={onToggleGrid}
        title="Mostrar/ocultar grade"
      >
        <Grid3x3 className="h-3.5 w-3.5" />
      </Button>
      <div className="flex-1" />
      <Button
        size="sm"
        variant="outline"
        disabled={downloadingProject}
        onClick={onDownloadProject}
        title="Baixa um .zip com o caso inteiro (metadados + arquivos de malha reais) — backup restauravel a qualquer momento"
      >
        {downloadingProject ? "Preparando..." : "Baixar projeto (.zip)"}
      </Button>
      <Button size="sm" onClick={onUpload}>
        Enviar malha
      </Button>
    </div>
  );
}
