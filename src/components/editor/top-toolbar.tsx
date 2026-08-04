"use client";

import { Redo2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ToolId, useEditorStore } from "@/client/state/editor-store";

const TOOLS: { id: ToolId; label: string; requiresSelectionMin?: number }[] = [
  { id: "select", label: "Selecionar" },
  { id: "transform", label: "Mover/Transformar", requiresSelectionMin: 1 },
  { id: "duplicate", label: "Duplicar", requiresSelectionMin: 1 },
  { id: "align", label: "Alinhar", requiresSelectionMin: 0 },
  { id: "booleanCut", label: "Corte booleano", requiresSelectionMin: 2 },
  { id: "relief", label: "Alivio", requiresSelectionMin: 1 },
  { id: "compare", label: "Comparar antes/depois", requiresSelectionMin: 0 },
];

/**
 * Toolbar sempre visivel, estilo Photoshop — nenhuma ferramenta fica escondida atras de um fluxo
 * fechado. O que muda por contexto de selecao e so o habilitado/desabilitado (ver ARCHITECTURE.md).
 */
export function TopToolbar({ onUndo, onGroup, onUpload }: { onUndo: () => void; onGroup: () => void; onUpload: () => void }) {
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
          >
            {tool.label}
          </Button>
        );
      })}
      <div className="mx-2 h-6 w-px bg-panel-border" />
      <Button size="sm" variant="ghost" disabled={selectedAssetIds.length < 2} onClick={onGroup}>
        Agrupar
      </Button>
      <Button size="sm" variant="ghost" onClick={onUndo}>
        <Undo2 className="mr-1 h-3.5 w-3.5" /> Desfazer
      </Button>
      <Button size="sm" variant="ghost" disabled title="Redo ainda nao implementado na Fase 1">
        <Redo2 className="mr-1 h-3.5 w-3.5" /> Refazer
      </Button>
      <div className="flex-1" />
      <Button size="sm" onClick={onUpload}>
        Enviar malha
      </Button>
    </div>
  );
}
