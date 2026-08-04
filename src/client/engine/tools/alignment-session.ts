import { Matrix4, Quaternion, Vector3 } from "three";

import { TransformDelta } from "@/server/lib/rigid-transform";
import { computeRigidAlignment } from "@/client/engine/tools/kabsch";

/**
 * Sessao de alinhamento manual por N pontos (estilo exocad/Meshmixer): usuario clica pontos
 * correspondentes em duas malhas ("source" que vai mover, "target" que fica parada), e ao chamar
 * `computeDelta()` (>=3 pares) recebe o delta de transform rigido pra alinhar source sobre target
 * (Kabsch — ver `kabsch.ts`). O delta, nao um transform absoluto, e o que permite propagar o mesmo
 * movimento pras malhas vinculadas ao source no `commitOperation()` do servidor.
 */
export class AlignmentSession {
  private readonly sourcePoints: Vector3[] = [];
  private readonly targetPoints: Vector3[] = [];

  addPointPair(sourcePoint: Vector3, targetPoint: Vector3): void {
    this.sourcePoints.push(sourcePoint.clone());
    this.targetPoints.push(targetPoint.clone());
  }

  get pairCount(): number {
    return this.sourcePoints.length;
  }

  reset(): void {
    this.sourcePoints.length = 0;
    this.targetPoints.length = 0;
  }

  computeDelta(): TransformDelta {
    const matrix = computeRigidAlignment(this.sourcePoints, this.targetPoints);
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    matrix.decompose(position, quaternion, scale);

    return {
      deltaPosition: position.toArray() as [number, number, number],
      deltaQuaternion: quaternion.toArray() as [number, number, number, number],
      deltaScale: [1, 1, 1],
    };
  }
}

export function identityMatrix(): Matrix4 {
  return new Matrix4().identity();
}
