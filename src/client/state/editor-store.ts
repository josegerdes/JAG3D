import { create } from "zustand";

export type ToolId =
  | "select"
  | "transform"
  | "duplicate"
  | "align"
  | "booleanCut"
  | "relief"
  | "smooth"
  | "compare";

export interface MeshAssetState {
  id: string;
  caseId: string;
  groupId: string | null;
  name: string;
  format: "stl" | "ply" | "obj";
  triangleCount: number;
  linkedGroupId: string | null;
  syncVersion: number;
  visible: boolean;
  locked: boolean;
}

export interface MeshGroupState {
  id: string;
  name: string;
  meshAssetIds: string[];
  visible: boolean;
  locked: boolean;
}

export type SyncStatus = "synced" | "checking" | "conflict" | "offline";
export type LicenseStatus = "checking" | "active" | "inactive";

interface EditorState {
  caseId: string | null;
  assets: Record<string, MeshAssetState>;
  groups: Record<string, MeshGroupState>;
  selectedAssetIds: string[];
  activeTool: ToolId;
  syncStatus: SyncStatus;
  licenseStatus: LicenseStatus;
  compareActive: boolean;
  compareMode: "overlay" | "split";
  splitRatio: number;

  setCase: (caseId: string | null) => void;
  setAssets: (assets: MeshAssetState[]) => void;
  upsertAsset: (asset: MeshAssetState) => void;
  removeAsset: (assetId: string) => void;
  setGroups: (groups: MeshGroupState[]) => void;
  select: (assetIds: string[]) => void;
  setActiveTool: (tool: ToolId) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setLicenseStatus: (status: LicenseStatus) => void;
  setCompareActive: (active: boolean) => void;
  setCompareMode: (mode: "overlay" | "split") => void;
  setSplitRatio: (ratio: number) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  caseId: null,
  assets: {},
  groups: {},
  selectedAssetIds: [],
  activeTool: "select",
  syncStatus: "synced",
  licenseStatus: "checking",
  compareActive: false,
  compareMode: "overlay",
  splitRatio: 0.5,

  setCase: (caseId) => set({ caseId }),
  setAssets: (assets) =>
    set({ assets: Object.fromEntries(assets.map((asset) => [asset.id, asset])) }),
  upsertAsset: (asset) => set((state) => ({ assets: { ...state.assets, [asset.id]: asset } })),
  removeAsset: (assetId) =>
    set((state) => {
      const next = { ...state.assets };
      delete next[assetId];
      return { assets: next, selectedAssetIds: state.selectedAssetIds.filter((id) => id !== assetId) };
    }),
  setGroups: (groups) => set({ groups: Object.fromEntries(groups.map((group) => [group.id, group])) }),
  select: (assetIds) => set({ selectedAssetIds: assetIds }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setSyncStatus: (status) => set({ syncStatus: status }),
  setLicenseStatus: (status) => set({ licenseStatus: status }),
  setCompareActive: (active) => set({ compareActive: active }),
  setCompareMode: (mode) => set({ compareMode: mode }),
  setSplitRatio: (ratio) => set({ splitRatio: ratio }),
}));
