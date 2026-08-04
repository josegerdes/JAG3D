import { Mesh, Vector2, Vector3 } from "three";

import { JAG3DViewportEngine } from "@/client/engine/JAG3DViewportEngine";

export type CompareMode = "overlay" | "split";

/**
 * Modo "Comparar" antes/depois (harmonizacao facial — ver ARCHITECTURE.md). Dois submodos sobre o
 * mesmo par de malhas, ambos usando o MESMO centro de orbita (calculado uma vez a partir do centro
 * da malha "antes" pos-alinhamento) — girar continua girando as duas em torno do mesmo eixo em
 * qualquer um dos dois modos.
 */
export class CompareController {
  private beforeMesh: Mesh | null = null;
  private afterMesh: Mesh | null = null;
  private mode: CompareMode = "overlay";
  private splitRatio = 0.5;
  private active = false;
  private readonly sizeScratch = new Vector2();

  constructor(private readonly engine: JAG3DViewportEngine) {}

  activate(beforeAssetId: string, afterAssetId: string): void {
    const before = this.engine.getMesh(beforeAssetId);
    const after = this.engine.getMesh(afterAssetId);
    if (!before || !after) throw new Error("Malhas do par de comparacao nao estao carregadas na engine");

    this.beforeMesh = before;
    this.afterMesh = after;
    this.active = true;

    const center = before.geometry.boundingSphere?.center ?? new Vector3();
    this.engine.orbitControls.target.copy(before.localToWorld(center.clone()));

    this.applyMode();
  }

  deactivate(): void {
    this.active = false;
    if (this.beforeMesh) this.beforeMesh.visible = true;
    if (this.afterMesh) this.afterMesh.visible = true;
    this.engine.setRenderOverride(null);
    this.beforeMesh = null;
    this.afterMesh = null;
  }

  setMode(mode: CompareMode): void {
    this.mode = mode;
    if (this.active) this.applyMode();
  }

  setSplitRatio(ratio: number): void {
    this.splitRatio = Math.min(1, Math.max(0, ratio));
  }

  /** Overlay: alterna qual das duas malhas esta visivel — camera nunca reseta. */
  toggleOverlayVisible(): void {
    if (this.mode !== "overlay" || !this.beforeMesh || !this.afterMesh) return;
    this.beforeMesh.visible = !this.beforeMesh.visible;
    this.afterMesh.visible = this.beforeMesh.visible ? false : true;
  }

  private applyMode(): void {
    if (!this.beforeMesh || !this.afterMesh) return;

    if (this.mode === "overlay") {
      this.engine.setRenderOverride(null);
      this.beforeMesh.visible = true;
      this.afterMesh.visible = false;
      return;
    }

    this.engine.setRenderOverride(() => this.renderSplit());
  }

  /** Split-screen: renderiza a cena duas vezes por frame a partir da MESMA pose de camera (uma com
   *  "antes" visivel, outra com "depois"), compondo via scissor-rect que segue o divisor arrastavel. */
  private renderSplit(): void {
    const { renderer, scene, camera } = this.engine;
    if (!this.beforeMesh || !this.afterMesh) return;

    renderer.getSize(this.sizeScratch);
    const width = this.sizeScratch.x;
    const height = this.sizeScratch.y;
    const splitX = Math.round(width * this.splitRatio);

    renderer.setScissorTest(true);

    this.beforeMesh.visible = true;
    this.afterMesh.visible = false;
    renderer.setViewport(0, 0, width, height);
    renderer.setScissor(0, 0, splitX, height);
    renderer.render(scene, camera);

    this.beforeMesh.visible = false;
    this.afterMesh.visible = true;
    renderer.setViewport(0, 0, width, height);
    renderer.setScissor(splitX, 0, width - splitX, height);
    renderer.render(scene, camera);

    renderer.setScissorTest(false);
    this.beforeMesh.visible = true;
    this.afterMesh.visible = true;
  }
}
