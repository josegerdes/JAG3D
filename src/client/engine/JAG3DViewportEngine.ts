import {
  AmbientLight,
  Box3,
  BufferGeometry,
  DirectionalLight,
  GridHelper,
  Mesh,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";

import { MeshFormat, RigidTransform } from "@/server/db/schema";
import { fetchRawBytes } from "@/client/api/client";
import { makeDefaultMaterial, parseMeshBuffer } from "@/client/engine/loaders";
import { licenseManager } from "@/client/license/license-manager";

// Patch de prototype do three-mesh-bvh — sem tipos oficiais pros novos metodos, entao precisa do
// cast. Feito uma vez, no module scope, antes de qualquer geometria ser criada.
Mesh.prototype.raycast = acceleratedRaycast;
(BufferGeometry.prototype as unknown as { computeBoundsTree: typeof computeBoundsTree }).computeBoundsTree =
  computeBoundsTree;
(BufferGeometry.prototype as unknown as { disposeBoundsTree: typeof disposeBoundsTree }).disposeBoundsTree =
  disposeBoundsTree;

export interface EngineMeshEntry {
  assetId: string;
  mesh: Mesh;
  format: MeshFormat;
  linkedGroupId: string | null;
}

export type SelectionChangeListener = (selectedIds: string[]) => void;
export type LicenseBlockedListener = () => void;

/**
 * Engine imperativa dona da cena Three.js — nunca gerenciada por React/reconciler (ver
 * ARCHITECTURE.md: editor CAD com gizmo a 60-120Hz e pilha de undo/redo baseada em comando, o
 * oposto do que `@react-three/fiber` foi pensado pra fazer bem). Montada uma vez por
 * `Viewport.tsx`, com API imperativa chamada pelos paineis React.
 */
export class JAG3DViewportEngine {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly orbitControls: OrbitControls;
  readonly transformControls: TransformControls;
  private readonly raycaster = new Raycaster();
  private readonly pointerNdc = new Vector2();

  private readonly meshes = new Map<string, EngineMeshEntry>();
  private selection: string[] = [];
  private selectionListeners = new Set<SelectionChangeListener>();
  private licenseBlockedListeners = new Set<LicenseBlockedListener>();
  private animationFrameId: number | null = null;
  /** Instalado pelo `CompareController` quando o modo split-screen esta ativo — substitui o render
   *  padrao por um render duplo com scissor (ver compare-controller.ts). */
  private renderOverride: (() => void) | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const { clientWidth, clientHeight } = canvas;
    this.camera = new PerspectiveCamera(45, clientWidth / Math.max(clientHeight, 1), 0.1, 5000);
    this.camera.position.set(0, 80, 200);

    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(clientWidth, clientHeight, false);

    this.scene.add(new AmbientLight(0xffffff, 0.6));
    const key = new DirectionalLight(0xffffff, 1.2);
    key.position.set(100, 200, 150);
    this.scene.add(key);
    const grid = new GridHelper(400, 40, 0x2a2f3a, 0x1c1f27);
    this.scene.add(grid);

    this.orbitControls = new OrbitControls(this.camera, canvas);
    this.orbitControls.enableDamping = true;

    this.transformControls = new TransformControls(this.camera, canvas);
    this.transformControls.addEventListener("dragging-changed", (event) => {
      this.orbitControls.enabled = !event.value;
    });
    this.scene.add(this.transformControls.getHelper?.() ?? (this.transformControls as unknown as never));

    this.tick = this.tick.bind(this);
    this.tick();
  }

  private tick(): void {
    this.orbitControls.update();
    if (this.renderOverride) this.renderOverride();
    else this.renderer.render(this.scene, this.camera);
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  setRenderOverride(fn: (() => void) | null): void {
    this.renderOverride = fn;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  dispose(): void {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.transformControls.dispose();
    this.orbitControls.dispose();
    for (const entry of this.meshes.values()) this.disposeMeshEntry(entry);
    this.renderer.dispose();
  }

  // ---- Carregamento de malha ----

  async loadMeshAsset(params: {
    assetId: string;
    format: MeshFormat;
    transform: RigidTransform;
    linkedGroupId: string | null;
  }): Promise<void> {
    const buffer = await fetchRawBytes(`/api/mesh-assets/${params.assetId}/raw`);
    const geometry = parseMeshBuffer(params.format, buffer);
    geometry.computeVertexNormals();
    geometry.computeBoundsTree?.();

    const mesh = new Mesh(geometry, makeDefaultMaterial());
    mesh.name = params.assetId;
    applyRigidTransform(mesh, params.transform);
    this.scene.add(mesh);

    this.meshes.set(params.assetId, {
      assetId: params.assetId,
      mesh,
      format: params.format,
      linkedGroupId: params.linkedGroupId,
    });
  }

  unloadMeshAsset(assetId: string): void {
    const entry = this.meshes.get(assetId);
    if (!entry) return;
    this.scene.remove(entry.mesh);
    this.disposeMeshEntry(entry);
    this.meshes.delete(assetId);
    this.selection = this.selection.filter((id) => id !== assetId);
  }

  private disposeMeshEntry(entry: EngineMeshEntry): void {
    entry.mesh.geometry.dispose();
    if (Array.isArray(entry.mesh.material)) entry.mesh.material.forEach((m) => m.dispose());
    else entry.mesh.material.dispose();
  }

  getMesh(assetId: string): Mesh | undefined {
    return this.meshes.get(assetId)?.mesh;
  }

  getAllEntries(): EngineMeshEntry[] {
    return Array.from(this.meshes.values());
  }

  frameAll(): void {
    const box = new Box3();
    for (const entry of this.meshes.values()) box.expandByObject(entry.mesh);
    if (box.isEmpty()) return;
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3()).length();
    this.orbitControls.target.copy(center);
    this.camera.position.copy(center).add(new Vector3(size * 0.6, size * 0.5, size * 0.8));
    this.camera.updateProjectionMatrix();
  }

  // ---- Selecao ----

  onSelectionChange(listener: SelectionChangeListener): () => void {
    this.selectionListeners.add(listener);
    return () => this.selectionListeners.delete(listener);
  }

  pickAtPointer(ndcX: number, ndcY: number, additive: boolean): void {
    this.pointerNdc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const targets = Array.from(this.meshes.values()).map((entry) => entry.mesh);
    const [hit] = this.raycaster.intersectObjects(targets, false);
    if (!hit) {
      if (!additive) this.setSelection([]);
      return;
    }
    const assetId = hit.object.name;
    if (additive) {
      const next = this.selection.includes(assetId)
        ? this.selection.filter((id) => id !== assetId)
        : [...this.selection, assetId];
      this.setSelection(next);
    } else {
      this.setSelection([assetId]);
    }
  }

  setSelection(assetIds: string[]): void {
    this.selection = assetIds;
    const primary = assetIds[assetIds.length - 1];
    const mesh = primary ? this.meshes.get(primary)?.mesh : undefined;
    if (mesh) this.transformControls.attach(mesh);
    else this.transformControls.detach();
    for (const listener of this.selectionListeners) listener(assetIds);
  }

  getSelection(): string[] {
    return this.selection;
  }

  // ---- Gate de licenca (ver SECURITY.md, camada 2) ----

  onLicenseBlocked(listener: LicenseBlockedListener): () => void {
    this.licenseBlockedListeners.add(listener);
    return () => this.licenseBlockedListeners.delete(listener);
  }

  /** Toda ferramenta chama isso antes de agir — trava local, nao substitui a checagem do servidor
   *  em save/export (backstop real, ver SECURITY.md). */
  async assertLicensed(): Promise<boolean> {
    const ok = await licenseManager.hasValidToken();
    if (!ok) {
      this.transformControls.detach();
      for (const listener of this.licenseBlockedListeners) listener();
    }
    return ok;
  }
}

export function applyRigidTransform(mesh: Mesh, transform: RigidTransform): void {
  mesh.position.set(...transform.position);
  mesh.quaternion.copy(new Quaternion(...transform.quaternion));
  mesh.scale.set(...transform.scale);
}

export function readRigidTransform(mesh: Mesh): RigidTransform {
  return {
    position: mesh.position.toArray() as [number, number, number],
    quaternion: mesh.quaternion.toArray() as [number, number, number, number],
    scale: mesh.scale.toArray() as [number, number, number],
  };
}
