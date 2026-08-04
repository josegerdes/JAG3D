"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Mesh, Vector3 } from "three";
import { toast } from "sonner";

import { MeshFormat, RigidTransform } from "@/server/db/schema";
import { api } from "@/client/api/client";
import { commitOperation, stageGeometryResult, undoLastOperation, checkIntegrity } from "@/client/api/mesh-tools";
import { JAG3DViewportEngine, readRigidTransform } from "@/client/engine/JAG3DViewportEngine";
import { CompareController } from "@/client/engine/compare-controller";
import { AlignmentSession } from "@/client/engine/tools/alignment-session";
import { performBooleanOp } from "@/client/engine/tools/boolean-cut";
import { createReliefBrush } from "@/client/engine/tools/relief-brush";
import { licenseManager } from "@/client/license/license-manager";
import { useEditorStore } from "@/client/state/editor-store";
import { TopToolbar } from "@/components/editor/top-toolbar";
import { MeshGroupsPanel } from "@/components/editor/mesh-groups-panel";
import { PropertiesPanel } from "@/components/editor/properties-panel";
import { StatusBar } from "@/components/editor/status-bar";

interface RemoteAsset {
  id: string;
  caseId: string;
  groupId: string | null;
  name: string;
  format: MeshFormat;
  triangleCount: number;
  transform: RigidTransform;
  linkedGroupId: string | null;
  syncVersion: number;
}

interface RemoteGroup {
  id: string;
  name: string;
  meshAssetIds: string[];
  visible: boolean;
  locked: boolean;
}

export default function CaseEditorPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;
  const router = useRouter();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<JAG3DViewportEngine | null>(null);
  const compareRef = useRef<CompareController | null>(null);
  const alignSessionRef = useRef(new AlignmentSession());
  const pendingSourcePointRef = useRef<Vector3 | null>(null);

  const [caseName, setCaseName] = useState("");
  const [ready, setReady] = useState(false);
  const [reliefRadius, setReliefRadius] = useState(2);
  const [alignPairCount, setAlignPairCount] = useState(0);
  const [compareBeforeId, setCompareBeforeId] = useState<string | null>(null);
  const [compareAfterId, setCompareAfterId] = useState<string | null>(null);

  const store = useEditorStore();
  const { activeTool, compareActive, compareMode, splitRatio, setCompareActive } = store;

  // ---- Montagem da engine + carga do caso ----
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new JAG3DViewportEngine(canvasRef.current);
    engineRef.current = engine;
    compareRef.current = new CompareController(engine);

    const unsubscribeSelection = engine.onSelectionChange((ids) => useEditorStore.getState().select(ids));
    const unsubscribeLicense = engine.onLicenseBlocked(() => {
      useEditorStore.getState().setLicenseStatus("inactive");
      toast.error("Licenca inativa — ferramentas bloqueadas ate renovar.");
    });

    let cancelled = false;
    async function init() {
      const licensed = await licenseManager.start();
      useEditorStore.getState().setLicenseStatus(licensed ? "active" : "inactive");
      licenseManager.onChange((ok) => useEditorStore.getState().setLicenseStatus(ok ? "active" : "inactive"));

      const [{ case: caseDoc }, { assets }, { groups }] = await Promise.all([
        api.get<{ case: { name: string } }>(`/api/cases/${caseId}`),
        api.get<{ assets: RemoteAsset[] }>(`/api/cases/${caseId}/meshes`),
        api.get<{ groups: RemoteGroup[] }>(`/api/cases/${caseId}/groups`),
      ]);
      if (cancelled) return;

      setCaseName(caseDoc.name);
      useEditorStore.getState().setCase(caseId);
      useEditorStore.getState().setAssets(
        assets.map((a) => ({
          id: a.id,
          caseId: a.caseId,
          groupId: a.groupId,
          name: a.name,
          format: a.format,
          triangleCount: a.triangleCount,
          linkedGroupId: a.linkedGroupId,
          syncVersion: a.syncVersion,
          visible: true,
          locked: false,
        }))
      );
      useEditorStore.getState().setGroups(groups);

      for (const asset of assets) {
        await engine.loadMeshAsset({
          assetId: asset.id,
          format: asset.format,
          transform: asset.transform,
          linkedGroupId: asset.linkedGroupId,
        });
      }
      engine.frameAll();
      setReady(true);
    }
    init().catch((error) => toast.error(error instanceof Error ? error.message : "Falha ao carregar caso"));

    return () => {
      cancelled = true;
      unsubscribeSelection();
      unsubscribeLicense();
      licenseManager.stop();
      engine.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  // ---- Resize do canvas ----
  useEffect(() => {
    const container = containerRef.current;
    const engine = engineRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      if (engineRef.current) engineRef.current.resize(container.clientWidth, container.clientHeight);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [ready]);

  // ---- Modo comparar: ativa/desativa o CompareController conforme o store ----
  useEffect(() => {
    const compare = compareRef.current;
    if (!compare) return;
    if (compareActive && compareBeforeId && compareAfterId) {
      compare.activate(compareBeforeId, compareAfterId);
      compare.setMode(compareMode);
    } else {
      compare.deactivate();
    }
  }, [compareActive, compareBeforeId, compareAfterId, compareMode]);

  useEffect(() => {
    compareRef.current?.setSplitRatio(splitRatio);
  }, [splitRatio]);

  // ---- Sincronia periodica (deteccao anti-dessincronizacao) ----
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(async () => {
      const assets = useEditorStore.getState().assets;
      const syncVersions = Object.fromEntries(Object.values(assets).map((a) => [a.id, a.syncVersion]));
      if (Object.keys(syncVersions).length === 0) return;
      useEditorStore.getState().setSyncStatus("checking");
      try {
        const report = await checkIntegrity(caseId, syncVersions);
        useEditorStore.getState().setSyncStatus(report.inSync ? "synced" : "conflict");
      } catch {
        useEditorStore.getState().setSyncStatus("offline");
      }
    }, 20_000);
    return () => clearInterval(interval);
  }, [ready, caseId]);

  // ---- Interacao no canvas — comportamento depende da ferramenta ativa ----
  function pointerToNdc(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
    };
  }

  async function handleCanvasClick(event: React.PointerEvent<HTMLCanvasElement>) {
    const engine = engineRef.current;
    if (!engine) return;
    const { x, y } = pointerToNdc(event);

    if (activeTool === "select" || activeTool === "transform" || activeTool === "duplicate" || activeTool === "booleanCut") {
      engine.pickAtPointer(x, y, event.shiftKey);
      return;
    }

    if (activeTool === "align") {
      await handleAlignClick(x, y);
      return;
    }

    if (activeTool === "relief") {
      await handleReliefClick(x, y);
    }
  }

  async function handleAlignClick(x: number, y: number) {
    const engine = engineRef.current;
    if (!engine) return;
    const selection = useEditorStore.getState().selectedAssetIds;
    const sourceAssetId = selection[selection.length - 1];
    if (!sourceAssetId) {
      toast.error("Selecione primeiro a malha que vai mover, depois use a ferramenta Alinhar.");
      return;
    }

    if (!pendingSourcePointRef.current) {
      const point = raycastAgainstAsset(engine, sourceAssetId, x, y);
      if (!point) {
        toast.error("Clique em um ponto sobre a malha selecionada (a que vai mover).");
        return;
      }
      pendingSourcePointRef.current = point;
      toast.info("Ponto de origem marcado — agora clique o ponto correspondente na malha de referencia.");
      return;
    }

    const targetPoint = raycastAnyExcept(engine, sourceAssetId, x, y);
    if (!targetPoint) {
      toast.error("Clique em um ponto sobre outra malha (a de referencia).");
      return;
    }
    alignSessionRef.current.addPointPair(pendingSourcePointRef.current, targetPoint);
    pendingSourcePointRef.current = null;
    setAlignPairCount(alignSessionRef.current.pairCount);
  }

  async function handleReliefClick(x: number, y: number) {
    const engine = engineRef.current;
    const selection = useEditorStore.getState().selectedAssetIds;
    const assetId = selection[0];
    if (!engine || !assetId) {
      toast.error("Selecione a malha que vai receber o alivio.");
      return;
    }
    if (!(await engine.assertLicensed())) return;

    const targetMesh = engine.getMesh(assetId);
    if (!targetMesh) return;

    const hit = raycastHit(engine, x, y, [targetMesh]);
    if (!hit) {
      toast.error("Clique sobre a malha selecionada.");
      return;
    }

    const asset = useEditorStore.getState().assets[assetId];
    if (!asset) return;

    const brush = createReliefBrush(hit.point, hit.normal, reliefRadius, "raise");
    const result = performBooleanOp(targetMesh, brush, "union");

    try {
      const staged = await stageGeometryResult(assetId, asset.format, result);
      const commit = await commitOperation(caseId, "relief", [
        {
          assetId,
          expectedSyncVersion: asset.syncVersion,
          geometryReplacement: {
            storageKey: staged.storageKey,
            checksumSha256: staged.checksumSha256,
            sizeBytes: staged.sizeBytes,
            triangleCount: staged.triangleCount,
          },
        },
      ]);
      await engine.reloadMeshGeometry(assetId);
      useEditorStore.getState().upsertAsset({ ...asset, syncVersion: commit.syncVersions[assetId] ?? asset.syncVersion + 1 });
      toast.success("Alivio aplicado.");
    } catch (error) {
      handleCommitError(error);
    }
  }

  async function handleBooleanCut() {
    const engine = engineRef.current;
    if (!engine) return;
    if (!(await engine.assertLicensed())) return;

    const [targetId, toolId] = useEditorStore.getState().selectedAssetIds;
    if (!targetId || !toolId) return;
    const targetMesh = engine.getMesh(targetId);
    const toolMesh = engine.getMesh(toolId);
    const asset = useEditorStore.getState().assets[targetId];
    if (!targetMesh || !toolMesh || !asset) return;

    const result = performBooleanOp(targetMesh, toolMesh, "subtract");
    try {
      const staged = await stageGeometryResult(targetId, asset.format, result);
      const commit = await commitOperation(caseId, "booleanCut", [
        {
          assetId: targetId,
          expectedSyncVersion: asset.syncVersion,
          geometryReplacement: {
            storageKey: staged.storageKey,
            checksumSha256: staged.checksumSha256,
            sizeBytes: staged.sizeBytes,
            triangleCount: staged.triangleCount,
          },
        },
      ]);
      await engine.reloadMeshGeometry(targetId);
      useEditorStore.getState().upsertAsset({ ...asset, syncVersion: commit.syncVersions[targetId] ?? asset.syncVersion + 1 });
      toast.success("Corte aplicado. A malha-ferramenta continua na cena — oculte ou apague se nao precisar mais dela.");
    } catch (error) {
      handleCommitError(error);
    }
  }

  async function handleCommitAlign() {
    const engine = engineRef.current;
    if (!engine) return;
    if (!(await engine.assertLicensed())) return;

    const selection = useEditorStore.getState().selectedAssetIds;
    const sourceAssetId = selection[selection.length - 1];
    const asset = sourceAssetId ? useEditorStore.getState().assets[sourceAssetId] : null;
    if (!sourceAssetId || !asset) return;

    try {
      const delta = alignSessionRef.current.computeDelta();
      const commit = await commitOperation(caseId, "transform", [
        { assetId: sourceAssetId, expectedSyncVersion: asset.syncVersion, transformDelta: delta },
      ]);
      applyCommittedTransforms(commit.syncVersions);
      alignSessionRef.current.reset();
      setAlignPairCount(0);
      toast.success("Alinhamento aplicado.");
    } catch (error) {
      handleCommitError(error);
    }
  }

  async function handleUndo() {
    try {
      await undoLastOperation(caseId);
      toast.success("Operacao desfeita — recarregando caso.");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nada para desfazer");
    }
  }

  async function handleGroup() {
    const selection = useEditorStore.getState().selectedAssetIds;
    if (selection.length < 2) return;
    try {
      const { group } = await api.post<{ group: RemoteGroup }>("/api/mesh-groups", {
        caseId,
        name: `Grupo ${Object.keys(useEditorStore.getState().groups).length + 1}`,
        meshAssetIds: selection,
      });
      useEditorStore.getState().setGroups([...Object.values(useEditorStore.getState().groups), group]);
      for (const id of selection) {
        const asset = useEditorStore.getState().assets[id];
        if (asset) useEditorStore.getState().upsertAsset({ ...asset, groupId: group.id });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao agrupar");
    }
  }

  function handleUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".stl,.ply,.obj";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const engine = engineRef.current;
      if (!engine || !(await engine.assertLicensed())) return;

      const form = new FormData();
      form.append("file", file);
      form.append("name", file.name);
      try {
        const { asset } = await api.postForm<{ asset: RemoteAsset }>(`/api/cases/${caseId}/meshes`, form);
        useEditorStore.getState().upsertAsset({
          id: asset.id,
          caseId: asset.caseId,
          groupId: asset.groupId,
          name: asset.name,
          format: asset.format,
          triangleCount: asset.triangleCount,
          linkedGroupId: asset.linkedGroupId,
          syncVersion: asset.syncVersion,
          visible: true,
          locked: false,
        });
        await engine.loadMeshAsset({
          assetId: asset.id,
          format: asset.format,
          transform: asset.transform,
          linkedGroupId: asset.linkedGroupId,
        });
        engine.frameAll();
        toast.success(`"${asset.name}" enviada.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha no upload");
      }
    };
    input.click();
  }

  function handleToggleVisible(assetId: string) {
    const engine = engineRef.current;
    const mesh = engine?.getMesh(assetId);
    const asset = useEditorStore.getState().assets[assetId];
    if (!mesh || !asset) return;
    mesh.visible = !mesh.visible;
    useEditorStore.getState().upsertAsset({ ...asset, visible: mesh.visible });
  }

  function handleToggleLock(assetId: string) {
    const asset = useEditorStore.getState().assets[assetId];
    if (!asset) return;
    useEditorStore.getState().upsertAsset({ ...asset, locked: !asset.locked });
  }

  async function handleToggleLink(assetId: string) {
    const asset = useEditorStore.getState().assets[assetId];
    if (!asset) return;
    const linkedGroupId = asset.linkedGroupId ? null : (asset.groupId ?? assetId);
    try {
      await api.patch(`/api/mesh-assets/${assetId}`, { linkedGroupId });
      useEditorStore.getState().upsertAsset({ ...asset, linkedGroupId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao vincular");
    }
  }

  function applyCommittedTransforms(syncVersions: Record<string, number>) {
    const engine = engineRef.current;
    if (!engine) return;
    for (const [assetId, version] of Object.entries(syncVersions)) {
      const mesh = engine.getMesh(assetId);
      const asset = useEditorStore.getState().assets[assetId];
      if (!mesh || !asset) continue;
      useEditorStore.getState().upsertAsset({ ...asset, syncVersion: version });
    }
    void syncVersions;
  }

  function handleCommitError(error: unknown) {
    if (error instanceof Error && error.message.includes("alterada por outra sessao")) {
      useEditorStore.getState().setSyncStatus("conflict");
      toast.error("Essa malha foi alterada em outra sessao — recarregue a pagina.");
      return;
    }
    toast.error(error instanceof Error ? error.message : "Falha ao aplicar operacao");
  }

  // ---- TransformControls: ao soltar o gizmo, commita o delta ----
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !ready) return;
    let startTransform: RigidTransform | null = null;

    function onDraggingChanged(event: { value: unknown }) {
      const dragging = Boolean(event.value);
      const selection = useEditorStore.getState().selectedAssetIds;
      const assetId = selection[selection.length - 1];
      const mesh = assetId ? engineRef.current?.getMesh(assetId) : undefined;
      if (dragging && mesh) {
        startTransform = readRigidTransform(mesh);
        return;
      }
      if (!dragging && mesh && startTransform && assetId) {
        void commitTransformDelta(assetId, startTransform, readRigidTransform(mesh));
        startTransform = null;
      }
    }

    engine.transformControls.addEventListener("dragging-changed", onDraggingChanged);
    return () => engine.transformControls.removeEventListener("dragging-changed", onDraggingChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commitTransformDelta le sempre o estado mais recente via getState(), nao precisa disparar novo effect.
  }, [ready]);

  async function commitTransformDelta(assetId: string, before: RigidTransform, after: RigidTransform) {
    const engine = engineRef.current;
    if (!engine || !(await engine.assertLicensed())) return;
    const asset = useEditorStore.getState().assets[assetId];
    if (!asset) return;

    const deltaPosition: [number, number, number] = [
      after.position[0] - before.position[0],
      after.position[1] - before.position[1],
      after.position[2] - before.position[2],
    ];

    try {
      const commit = await commitOperation(caseId, "transform", [
        {
          assetId,
          expectedSyncVersion: asset.syncVersion,
          transformDelta: { deltaPosition, deltaQuaternion: after.quaternion, deltaScale: [1, 1, 1] },
        },
      ]);
      applyCommittedTransforms(commit.syncVersions);
    } catch (error) {
      handleCommitError(error);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex h-10 items-center gap-3 border-b border-panel-border bg-panel px-3 text-xs text-panel-foreground">
        <button className="text-muted-foreground hover:text-foreground" onClick={() => router.push("/")}>
          &larr; Casos
        </button>
        <span className="font-medium">{caseName || "Carregando..."}</span>
      </div>
      <TopToolbar onUndo={handleUndo} onGroup={handleGroup} onUpload={handleUpload} />
      <div className="flex flex-1 overflow-hidden">
        <MeshGroupsPanel onToggleVisible={handleToggleVisible} onToggleLock={handleToggleLock} onToggleLink={handleToggleLink} />
        <div ref={containerRef} className="relative flex-1 bg-black">
          <canvas ref={canvasRef} className="h-full w-full touch-none" onPointerDown={handleCanvasClick} />
        </div>
        <PropertiesPanel
          reliefRadius={reliefRadius}
          onReliefRadiusChange={setReliefRadius}
          onCommitAlign={handleCommitAlign}
          alignPairCount={alignPairCount}
          onBooleanCut={handleBooleanCut}
          compareBeforeId={compareBeforeId}
          compareAfterId={compareAfterId}
          onCompareBeforeChange={setCompareBeforeId}
          onCompareAfterChange={setCompareAfterId}
          onStartCompare={() => setCompareActive(true)}
          compareActive={compareActive}
          onStopCompare={() => setCompareActive(false)}
        />
      </div>
      <StatusBar />
    </div>
  );
}

function raycastHit(
  engine: JAG3DViewportEngine,
  ndcX: number,
  ndcY: number,
  targets: Mesh[]
): { point: Vector3; normal: Vector3 } | null {
  const hit = engine.raycastAtPointer(ndcX, ndcY, targets);
  if (!hit) return null;
  return { point: hit.point.clone(), normal: (hit.face?.normal ?? new Vector3(0, 1, 0)).clone() };
}

function raycastAgainstAsset(engine: JAG3DViewportEngine, assetId: string, ndcX: number, ndcY: number): Vector3 | null {
  const mesh = engine.getMesh(assetId);
  if (!mesh) return null;
  return raycastHit(engine, ndcX, ndcY, [mesh])?.point ?? null;
}

function raycastAnyExcept(engine: JAG3DViewportEngine, excludeAssetId: string, ndcX: number, ndcY: number): Vector3 | null {
  const others = engine.getAllEntries().filter((entry) => entry.assetId !== excludeAssetId).map((entry) => entry.mesh);
  return raycastHit(engine, ndcX, ndcY, others)?.point ?? null;
}
