import { Mesh, SphereGeometry, Vector3 } from "three";

import { makeDefaultMaterial } from "@/client/engine/loaders";

export type ReliefDirection = "raise" | "indent";

/**
 * Alivio (Fase 1): "carimbo" parametrico — uma esfera posicionada no ponto/normal escolhido pelo
 * usuario, unida (raise) ou subtraida (indent) via o mesmo motor booleano do corte
 * (`performBooleanOp`). Escultura livre de verdade (deformar a malha continuamente sob o cursor)
 * fica pra uma fase futura — ver ARCHITECTURE.md.
 */
export function createReliefBrush(point: Vector3, normal: Vector3, radius: number, direction: ReliefDirection): Mesh {
  const geometry = new SphereGeometry(radius, 32, 24);
  const brush = new Mesh(geometry, makeDefaultMaterial());
  const offset = direction === "raise" ? radius * 0.35 : -radius * 0.35;
  brush.position.copy(point).addScaledVector(normal.clone().normalize(), offset);
  return brush;
}
