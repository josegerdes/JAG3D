"use client";

import { useEditorStore } from "@/client/state/editor-store";
import { RangeSlider } from "@/components/ui/range-slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  reliefRadius: number;
  onReliefRadiusChange: (value: number) => void;
  onCommitAlign: () => void;
  alignPairCount: number;
  onBooleanCut: () => void;
  compareBeforeId: string | null;
  compareAfterId: string | null;
  onCompareBeforeChange: (id: string) => void;
  onCompareAfterChange: (id: string) => void;
  onStartCompare: () => void;
  compareActive: boolean;
  onStopCompare: () => void;
}

/** Painel contextual — o que aparece depende da ferramenta ativa/selecao, nunca um modal que
 *  bloqueia o resto da UI (ver ARCHITECTURE.md, layout estilo Photoshop). */
export function PropertiesPanel({
  reliefRadius,
  onReliefRadiusChange,
  onCommitAlign,
  alignPairCount,
  onBooleanCut,
  compareBeforeId,
  compareAfterId,
  onCompareBeforeChange,
  onCompareAfterChange,
  onStartCompare,
  compareActive,
  onStopCompare,
}: Props) {
  const { activeTool, selectedAssetIds, assets, compareMode, setCompareMode, splitRatio, setSplitRatio } = useEditorStore();
  const selected = selectedAssetIds.map((id) => assets[id]).filter((a): a is NonNullable<typeof a> => Boolean(a));
  const assetOptions = Object.values(assets);

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-l border-panel-border bg-panel p-3 text-panel-foreground">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Propriedades</h2>

      {selected.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma malha selecionada.</p>}

      {selected.map((asset) => (
        <div key={asset.id} className="mb-3 rounded border border-panel-border p-2">
          <p className="truncate text-sm font-medium">{asset.name}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="secondary">{asset.format.toUpperCase()}</Badge>
            <Badge variant="outline">{asset.triangleCount.toLocaleString("pt-BR")} tri</Badge>
            <Badge variant="outline">sync v{asset.syncVersion}</Badge>
          </div>
        </div>
      ))}

      {activeTool === "relief" && (
        <div className="mt-4 space-y-2 border-t border-panel-border pt-3">
          <p className="text-xs font-medium">Alivio — raio ({reliefRadius.toFixed(1)}mm)</p>
          <RangeSlider min={0.5} max={10} step={0.1} value={reliefRadius} onChange={onReliefRadiusChange} />
          <p className="text-xs text-muted-foreground">Clique num ponto da malha selecionada pra aplicar.</p>
        </div>
      )}

      {activeTool === "booleanCut" && (
        <div className="mt-4 space-y-2 border-t border-panel-border pt-3">
          <p className="text-xs font-medium">Corte booleano</p>
          <p className="text-xs text-muted-foreground">
            Selecione a malha alvo e a malha-ferramenta (2 malhas) — a ferramenta e subtraida do alvo.
          </p>
          <Button size="sm" disabled={selectedAssetIds.length !== 2} onClick={onBooleanCut}>
            Aplicar corte
          </Button>
        </div>
      )}

      {activeTool === "align" && (
        <div className="mt-4 space-y-2 border-t border-panel-border pt-3">
          <p className="text-xs font-medium">Alinhamento manual (N pontos)</p>
          <p className="text-xs text-muted-foreground">
            Clique pontos correspondentes: primeiro na malha a mover, depois na malha de referencia.
            Pares registrados: {alignPairCount}.
          </p>
          <Button size="sm" disabled={alignPairCount < 3} onClick={onCommitAlign}>
            Aplicar alinhamento
          </Button>
        </div>
      )}

      {activeTool === "compare" && (
        <div className="mt-4 space-y-2 border-t border-panel-border pt-3">
          <p className="text-xs font-medium">Comparar antes/depois</p>
          {!compareActive ? (
            <>
              <select
                className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                value={compareBeforeId ?? ""}
                onChange={(e) => onCompareBeforeChange(e.target.value)}
              >
                <option value="">Malha &quot;antes&quot;...</option>
                {assetOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                value={compareAfterId ?? ""}
                onChange={(e) => onCompareAfterChange(e.target.value)}
              >
                <option value="">Malha &quot;depois&quot;...</option>
                {assetOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={!compareBeforeId || !compareAfterId || compareBeforeId === compareAfterId}
                onClick={onStartCompare}
              >
                Iniciar comparacao
              </Button>
            </>
          ) : (
            <>
              <div className="flex gap-1">
                <Button size="sm" variant={compareMode === "overlay" ? "default" : "outline"} onClick={() => setCompareMode("overlay")}>
                  Overlay
                </Button>
                <Button size="sm" variant={compareMode === "split" ? "default" : "outline"} onClick={() => setCompareMode("split")}>
                  Split-screen
                </Button>
              </div>
              {compareMode === "split" && (
                <RangeSlider min={0} max={1} step={0.01} value={splitRatio} onChange={setSplitRatio} />
              )}
              <Button size="sm" variant="ghost" onClick={onStopCompare}>
                Encerrar comparacao
              </Button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
