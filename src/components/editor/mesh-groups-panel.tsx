"use client";

import { Eye, EyeOff, Link2, Link2Off, Lock, Unlock } from "lucide-react";

import { cn } from "@/lib/utils";
import { MeshAssetState, useEditorStore } from "@/client/state/editor-store";
import { Button } from "@/components/ui/button";

interface Props {
  onToggleVisible: (assetId: string) => void;
  onToggleLock: (assetId: string) => void;
  onToggleLink: (assetId: string) => void;
}

/** Equivalente ao painel de Layers do Photoshop: arvore Grupo -> Malha, com indicador de vinculo
 *  (anti-dessincronizacao) por item — ver ARCHITECTURE.md. */
export function MeshGroupsPanel({ onToggleVisible, onToggleLock, onToggleLink }: Props) {
  const { assets, groups, selectedAssetIds, select } = useEditorStore();
  const assetList = Object.values(assets);
  const ungrouped = assetList.filter((a) => !a.groupId);

  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-r border-panel-border bg-panel p-2 text-panel-foreground">
      <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Malhas</h2>

      {Object.values(groups).map((group) => (
        <div key={group.id} className="mb-2">
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{group.name}</div>
          {group.meshAssetIds
            .map((id) => assets[id])
            .filter((a): a is MeshAssetState => Boolean(a))
            .map((asset) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                selected={selectedAssetIds.includes(asset.id)}
                onSelect={() => select([asset.id])}
                onToggleVisible={() => onToggleVisible(asset.id)}
                onToggleLock={() => onToggleLock(asset.id)}
                onToggleLink={() => onToggleLink(asset.id)}
              />
            ))}
        </div>
      ))}

      {ungrouped.map((asset) => (
        <AssetRow
          key={asset.id}
          asset={asset}
          selected={selectedAssetIds.includes(asset.id)}
          onSelect={() => select([asset.id])}
          onToggleVisible={() => onToggleVisible(asset.id)}
          onToggleLock={() => onToggleLock(asset.id)}
          onToggleLink={() => onToggleLink(asset.id)}
        />
      ))}

      {assetList.length === 0 && <p className="px-2 text-xs text-muted-foreground">Nenhuma malha enviada ainda.</p>}
    </aside>
  );
}

function AssetRow({
  asset,
  selected,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onToggleLink,
}: {
  asset: MeshAssetState;
  selected: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onToggleLock: () => void;
  onToggleLink: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-accent",
        selected && "bg-accent text-accent-foreground"
      )}
    >
      <button className="flex-1 truncate text-left" onClick={onSelect} title={asset.name}>
        {asset.name}
        <span className="ml-1 text-[10px] uppercase text-muted-foreground">{asset.format}</span>
      </button>
      <IconButton onClick={onToggleLink} active={Boolean(asset.linkedGroupId)} title="Vincular (anti-dessincronizacao)">
        {asset.linkedGroupId ? <Link2 className="h-3.5 w-3.5" /> : <Link2Off className="h-3.5 w-3.5" />}
      </IconButton>
      <IconButton onClick={onToggleLock} active={asset.locked} title="Bloquear">
        {asset.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
      </IconButton>
      <IconButton onClick={onToggleVisible} active={asset.visible} title="Visibilidade">
        {asset.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </IconButton>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  title: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-6 w-6", active && "text-primary")}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );
}
