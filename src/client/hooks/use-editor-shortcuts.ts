import { useEffect } from "react";

import { ToolId, useEditorStore } from "@/client/state/editor-store";

export interface EditorShortcutActions {
  onUndo: () => void;
  onGroup: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFrameAll: () => void;
  onEscape: () => void;
}

const TOOL_KEYS: Record<string, ToolId> = {
  v: "select",
  m: "transform",
  a: "align",
  b: "booleanCut",
  r: "relief",
  s: "smooth",
  c: "compare",
};

/**
 * Atalhos de teclado estilo exocad/CAD: uma letra por ferramenta (sempre disponivel, sem modo —
 * ver ARCHITECTURE.md, layout estilo Photoshop), Ctrl+D duplica, Ctrl+Z desfaz, Delete apaga
 * selecao, F enquadra tudo, Esc volta pra selecao. Ignora tudo isso quando o foco esta num campo
 * de texto/select, pra nao capturar digitacao normal.
 */
export function useEditorShortcuts(actions: EditorShortcutActions): void {
  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        actions.onUndo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        actions.onDuplicate();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "g") {
        actions.onGroup();
        return;
      }
      if (key === "delete" || key === "backspace") {
        actions.onDelete();
        return;
      }
      if (key === "f") {
        actions.onFrameAll();
        return;
      }
      if (key === "escape") {
        actions.onEscape();
        return;
      }
      const tool = TOOL_KEYS[key];
      if (tool) useEditorStore.getState().setActiveTool(tool);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- actions le sempre o mais recente via closure estavel do chamador (funcoes memorizadas no componente).
  }, []);
}
